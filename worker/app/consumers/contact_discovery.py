import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timezone

import httpx
from azure.servicebus.aio import ServiceBusClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.integrations.ai_foundry import ai_foundry

logger = logging.getLogger(__name__)

QUEUE_NAME = "contact-discovery"

APIFY_BASE = "https://api.apify.com/v2"

SCORING_SYSTEM_PROMPT = (
    "You are a job search assistant helping a candidate find "
    "the best people to reach out to for a coffee chat. "
    "Score each contact from 0-100 based on how useful they "
    "would be for someone applying for this role. "
    "Scoring criteria: "
    "- Same function/department as the job: +30 points "
    "- Recruiter or HR role: +25 points "
    "- Manager or team lead (not C-suite): +20 points "
    "- Tenure 0-18 months at company: +15 points "
    "- Same university as candidate: +25 points "
    "- Located in same city as job: +10 points "
    "- Unrelated department: -20 points "
    "- Tenure over 10 years: -10 points "
    "Return ONLY a JSON array with fields: linkedin_url, score (no other text)"
)

_engine = create_engine(
    settings.DATABASE_URL,
    isolation_level="AUTOCOMMIT",
)
_Session = sessionmaker(bind=_engine)


def _company_to_slug(company: str) -> str:
    slug = company.lower().strip()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug.strip("-")


def _extract_city(location: str | None) -> str:
    if not location:
        return ""
    return location.split(",")[0].strip()


def _tenure_months(tenure: dict | None) -> int:
    if not tenure:
        return 0
    return (tenure.get("numYears", 0) or 0) * 12 + (tenure.get("numMonths", 0) or 0)


def _extract_university(profile: dict) -> str:
    education = profile.get("education", [])
    if education and isinstance(education, list):
        return education[0].get("schoolName", "") or ""
    return ""


def _current_position(profile: dict) -> dict:
    for pos in profile.get("currentPositions", []):
        if pos.get("current"):
            return pos
    positions = profile.get("currentPositions", [])
    return positions[0] if positions else {}


async def _apify_run(client: httpx.AsyncClient, actor_id: str, run_input: dict) -> list:
    headers = {"Authorization": f"Bearer {settings.APIFY_API_TOKEN}"}

    r = await client.post(
        f"{APIFY_BASE}/acts/{actor_id}/runs",
        headers=headers,
        json=run_input,
    )
    r.raise_for_status()
    run_id = r.json()["data"]["id"]

    while True:
        await asyncio.sleep(10)
        r = await client.get(
            f"{APIFY_BASE}/actor-runs/{run_id}",
            headers=headers,
        )
        r.raise_for_status()
        status = r.json()["data"]["status"]
        if status == "SUCCEEDED":
            break
        if status in ("FAILED", "ABORTED", "TIMED-OUT"):
            raise RuntimeError(f"Apify run {run_id} ended with status: {status}")

    dataset_id = r.json()["data"]["defaultDatasetId"]
    r = await client.get(
        f"{APIFY_BASE}/datasets/{dataset_id}/items",
        headers=headers,
    )
    r.raise_for_status()
    return r.json()


async def _process(payload: dict):
    wf_id = payload["workflow_run_id"]
    job_id = uuid.UUID(payload["job_id"])
    user_id = uuid.UUID(payload["user_id"])

    def now():
        return datetime.now(timezone.utc)

    db = _Session()
    try:
        # --- Step 0: Setup ---
        db.execute(
            text("UPDATE workflow_runs SET status='running', started_at=:t WHERE id=:id"),
            {"t": now(), "id": wf_id},
        )

        job = db.execute(
            text("SELECT title, company, location FROM jobs WHERE id = :job_id"),
            {"job_id": job_id},
        ).fetchone()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        job_title = job[0] or ""
        job_company = job[1] or ""
        job_location = job[2] or ""

        candidate_university = ""
        resume_row = db.execute(
            text("SELECT extracted_text FROM resumes WHERE user_id = :user_id AND is_active = true LIMIT 1"),
            {"user_id": user_id},
        ).fetchone()
        if resume_row and resume_row[0]:
            candidate_university = await ai_foundry.run_flow(
                system_prompt=(
                    "Extract the university or college name this person attended "
                    "from their resume text. Return ONLY the institution name, "
                    "nothing else. If multiple universities exist, return the most "
                    "recent one. If none found, return empty string."
                ),
                user_message=resume_row[0],
            )
            candidate_university = candidate_university.strip().strip('"')

        # --- Step 1: Apify LinkedIn Company Employees ---
        slug = _company_to_slug(job_company)
        city = _extract_city(job_location)

        run_input = {
            "companies": [f"https://www.linkedin.com/company/{slug}/"],
            "profileScraperMode": "Full ($8 per 1k)",
            "maxItems": 15,
        }
        if city:
            run_input["locations"] = [city]

        async with httpx.AsyncClient(timeout=120.0) as client:
            profiles = await _apify_run(
                client, "harvestapi~linkedin-company-employees", run_input,
            )

        active_profiles = []
        for p in profiles:
            current_positions = p.get("currentPositions", [])
            has_current = any(pos.get("current") for pos in current_positions)
            if has_current and current_positions:
                active_profiles.append(p)

        if not active_profiles:
            logger.warning("No active profiles found for company %s", job_company)

        # --- Step 2: AI Scoring ---
        contacts_for_scoring = []
        for p in active_profiles:
            pos = _current_position(p)
            contacts_for_scoring.append({
                "linkedin_url": p.get("linkedinUrl", ""),
                "title": pos.get("title", ""),
                "location": (p.get("location", {}) or {}).get("linkedinText", ""),
                "tenure_months": _tenure_months(p.get("tenureAtCompany")),
                "university": _extract_university(p),
            })

        user_message = json.dumps({
            "job_title": job_title,
            "job_company": job_company,
            "job_location": job_location,
            "candidate_university": candidate_university,
            "contacts": contacts_for_scoring,
        })

        scoring_result = await ai_foundry.run_flow(
            system_prompt=SCORING_SYSTEM_PROMPT,
            user_message=user_message,
        )
        scores = json.loads(scoring_result)
        score_map = {s["linkedin_url"]: s["score"] for s in scores}

        active_profiles.sort(
            key=lambda p: score_map.get(p.get("linkedinUrl", ""), 0),
            reverse=True,
        )
        top5 = active_profiles[:5]

        # --- Step 3: Apify Profile Posts ---
        posts_map = {}
        async with httpx.AsyncClient(timeout=120.0) as client:
            for profile in top5:
                li_url = profile.get("linkedinUrl", "")
                if not li_url:
                    continue
                try:
                    items = await _apify_run(
                        client,
                        "apimaestro~linkedin-profile-posts",
                        {"urls": [li_url], "maxPosts": 3},
                    )
                    posts_map[li_url] = [
                        item.get("text", "") for item in items if item.get("text")
                    ]
                except Exception as exc:
                    logger.warning("Failed to fetch posts for %s: %s", li_url, exc)
                    posts_map[li_url] = []

        # --- Step 4: Save to DB ---
        for profile in top5:
            li_url = profile.get("linkedinUrl", "")
            pos = _current_position(profile)
            first = profile.get("firstName", "") or ""
            last = profile.get("lastName", "") or ""
            full_name = f"{first} {last}".strip()

            profile_with_posts = {**profile, "recent_posts": posts_map.get(li_url, [])}

            db.execute(
                text("""
                    INSERT INTO contacts
                        (id, job_id, user_id, full_name, linkedin_url, title,
                         company, location, university, tenure_months,
                         relevance_score, profile_data, created_at)
                    VALUES
                        (:id, :job_id, :user_id, :full_name, :linkedin_url, :title,
                         :company, :location, :university, :tenure_months,
                         :relevance_score, :profile_data, :t)
                """),
                {
                    "id": str(uuid.uuid4()),
                    "job_id": job_id,
                    "user_id": user_id,
                    "full_name": full_name,
                    "linkedin_url": li_url,
                    "title": pos.get("title", ""),
                    "company": pos.get("companyName", ""),
                    "location": (profile.get("location", {}) or {}).get("linkedinText", ""),
                    "university": _extract_university(profile),
                    "tenure_months": _tenure_months(profile.get("tenureAtCompany")),
                    "relevance_score": score_map.get(li_url, 0),
                    "profile_data": json.dumps(profile_with_posts),
                    "t": now(),
                },
            )

        # --- Step 5: Cleanup ---
        try:
            db.execute(
                text("""
                    INSERT INTO activity_log (id, job_id, user_id, action, created_at)
                    VALUES (:id, :job_id, :user_id, 'Contact discovery completed', :t)
                """),
                {"id": str(uuid.uuid4()), "job_id": job_id, "user_id": user_id, "t": now()},
            )
        except Exception as log_exc:
            logger.warning("Failed to insert activity_log for job_id %s: %s", job_id, log_exc)

        db.execute(
            text("""
                UPDATE workflow_runs SET status='completed', completed_at=:t,
                    output_data=:out WHERE id=:id
            """),
            {
                "t": now(),
                "out": json.dumps({"contacts_saved": len(top5)}),
                "id": wf_id,
            },
        )

    except Exception as exc:
        logger.error("contact_discovery failed: %s", exc, exc_info=True)
        db.rollback()
        db.execute(
            text("""
                UPDATE workflow_runs SET status='failed', error_message=:err, completed_at=:t
                WHERE id=:id
            """),
            {"err": str(exc), "t": now(), "id": wf_id},
        )
    finally:
        db.close()


async def listen():
    logger.info("Listening on queue: %s", QUEUE_NAME)
    async with ServiceBusClient.from_connection_string(settings.SERVICE_BUS_CONNECTION_STRING) as sb:
        async with sb.get_queue_receiver(queue_name=QUEUE_NAME) as receiver:
            async for msg in receiver:
                try:
                    await _process(json.loads(str(msg)))
                    await receiver.complete_message(msg)
                except Exception as exc:
                    logger.error("Message processing error: %s", exc, exc_info=True)
                    await receiver.abandon_message(msg)
