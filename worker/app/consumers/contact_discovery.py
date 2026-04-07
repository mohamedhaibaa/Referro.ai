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
    "Scoring criteria (apply in order, scores are additive): "
    "- Recruiter, HR, or Talent Acquisition role: +40 points (always high priority regardless of department) "
    "- Same function/department as the job: +30 points "
    "- Manager, team lead, or director (not C-suite): +20 points "
    "- Located in same city as job: +15 points "
    "- Tenure 0-18 months at company: +10 points "
    "- Same university as candidate: +20 points "
    "- Tenure over 10 years: -10 points "
    "- C-suite (CEO, CTO, CFO, etc.): -15 points (too senior to reach out to) "
    "Important: Recruiters and HR roles always score at least 40. "
    "Return ONLY a JSON array with fields: linkedin_url, score (no other text)"
)

_engine = create_engine(settings.DATABASE_URL)
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


def _tenure_months(tenure: dict | None, experience: list | None = None) -> int:
    if tenure:
        return (tenure.get("numYears", 0) or 0) * 12 + (tenure.get("numMonths", 0) or 0)
    # Fallback: parse duration string from experience[0] e.g. "17 yrs 2 mos"
    if experience and isinstance(experience, list) and experience:
        duration = experience[0].get("duration", "") or ""
        yrs = re.search(r"(\d+)\s*yr", duration)
        mos = re.search(r"(\d+)\s*mo", duration)
        return (int(yrs.group(1)) if yrs else 0) * 12 + (int(mos.group(1)) if mos else 0)
    return 0


def _extract_university(profile: dict) -> str:
    education = profile.get("education", [])
    if education and isinstance(education, list):
        return education[0].get("schoolName", "") or ""
    return ""


def _is_active(profile: dict) -> bool:
    """Return True if this profile is actively employed at the target company.

    The Apify harvestapi~linkedin-company-employees actor can return position
    data in several shapes depending on scraper mode:
      - currentPositions / currentPosition  (light summary, may be absent)
      - experience[]  (full history; current role has no endDate)
    """
    for key in ("currentPositions", "currentPosition"):
        val = profile.get(key)
        if val:
            return True
    experience = profile.get("experience") or []
    return any(not e.get("endDate") for e in experience)


def _current_position(profile: dict) -> dict:
    """Return a normalised current-position dict with 'title' and 'companyName'.

    Prioritises experience[] because it contains the full title (as 'position').
    currentPosition is a light summary with only companyName — no title field.
    """
    # experience[] has the richest data; prefer entries with no endDate
    experience = profile.get("experience") or []
    current = [e for e in experience if not e.get("endDate")]
    entry = (current or experience)
    if entry:
        pos = entry[0]
        title = pos.get("title") or pos.get("position", "")
        company = pos.get("companyName", "")
        if title or company:
            return {"title": title, "companyName": company}
    # Fall back to currentPosition/currentPositions (light summary, often lacks title)
    for key in ("currentPositions", "currentPosition"):
        cp = profile.get(key) or []
        if isinstance(cp, dict):
            cp = [cp]
        if cp:
            pos = cp[0]
            return {
                "title": pos.get("title") or pos.get("position", ""),
                "companyName": pos.get("companyName", ""),
            }
    return {}


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
            text("SELECT title, company, location, company_linkedin_url FROM jobs WHERE id = :job_id"),
            {"job_id": job_id},
        ).fetchone()
        if not job:
            raise ValueError(f"Job {job_id} not found")

        job_title = job[0] or ""
        job_company = job[1] or ""
        job_location = job[2] or ""
        company_linkedin_url = job[3] or ""

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
        # Use the exact company URL extracted from the job page HTML if available.
        # Fall back to slug guessing only as a last resort.
        if company_linkedin_url:
            linkedin_company_url = company_linkedin_url
            logger.info("Using extracted company URL: %s", linkedin_company_url)
        else:
            slug = _company_to_slug(job_company)
            linkedin_company_url = f"https://www.linkedin.com/company/{slug}/"
            logger.warning("No company_linkedin_url found — falling back to slug: %s", linkedin_company_url)

        city = _extract_city(job_location)

        run_input = {
            "companies": [linkedin_company_url],
            "profileScraperMode": "Full ($8 per 1k)",
            "maxItems": 15,
        }
        if city:
            run_input["locations"] = [city]

        async with httpx.AsyncClient(timeout=120.0) as client:
            profiles = await _apify_run(
                client, "harvestapi~linkedin-company-employees", run_input,
            )

        logger.info("Apify returned %d raw profiles for company %s", len(profiles), job_company)
        if profiles:
            sample_keys = list(profiles[0].keys())
            logger.info("Sample profile top-level keys: %s", sample_keys)

        active_profiles = [p for p in profiles if _is_active(p)]

        logger.info(
            "Active profiles after filter: %d / %d",
            len(active_profiles), len(profiles),
        )
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
                "tenure_months": _tenure_months(p.get("tenureAtCompany"), p.get("experience")),
                "university": _extract_university(p),
            })

        logger.info("Sending %d contacts to AI for scoring", len(contacts_for_scoring))

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
        logger.info("Raw AI scoring response: %r", scoring_result)
        # Strip markdown code fences if the model wrapped its output
        cleaned = scoring_result.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```[a-z]*\n?", "", cleaned)
            cleaned = re.sub(r"\n?```$", "", cleaned)
        scores = json.loads(cleaned)
        score_map = {s["linkedin_url"]: s["score"] for s in scores}
        logger.info("AI scores received: %s", score_map)

        active_profiles.sort(
            key=lambda p: score_map.get(p.get("linkedinUrl", ""), 0),
            reverse=True,
        )
        top5 = active_profiles[:5]
        logger.info(
            "Top 5 contacts selected: %s",
            [(p.get("linkedinUrl", ""), score_map.get(p.get("linkedinUrl", ""), 0)) for p in top5],
        )

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
        # Clear any previously discovered contacts for this job before saving new ones
        db.execute(
            text("DELETE FROM contacts WHERE job_id = :job_id AND user_id = :user_id"),
            {"job_id": job_id, "user_id": user_id},
        )
        logger.info("Saving %d contacts to DB for job_id=%s", len(top5), job_id)
        for i, profile in enumerate(top5):
            li_url = profile.get("linkedinUrl", "")
            pos = _current_position(profile)
            first = profile.get("firstName", "") or ""
            last = profile.get("lastName", "") or ""
            full_name = f"{first} {last}".strip()

            contact_params = {
                "id": str(uuid.uuid4()),
                "job_id": job_id,
                "user_id": user_id,
                "full_name": full_name,
                "linkedin_url": li_url,
                "title": pos.get("title", ""),
                "company": pos.get("companyName", ""),
                "location": (profile.get("location", {}) or {}).get("linkedinText", ""),
                "university": _extract_university(profile),
                "tenure_months": _tenure_months(profile.get("tenureAtCompany"), profile.get("experience")),
                "relevance_score": score_map.get(li_url, 0),
                "t": now(),
            }
            logger.info(
                "Inserting contact %d/%d: full_name=%r linkedin_url=%r title=%r score=%s",
                i + 1, len(top5),
                contact_params["full_name"],
                contact_params["linkedin_url"],
                contact_params["title"],
                contact_params["relevance_score"],
            )

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
                {**contact_params, "profile_data": json.dumps(profile_with_posts)},
            )
            logger.info("Contact %d/%d inserted successfully: %r", i + 1, len(top5), full_name)

        db.commit()
        logger.info("Committed %d contacts to DB", len(top5))

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
        db.commit()

    except Exception as exc:
        logger.error("contact_discovery FAILED — wf_id=%s job_id=%s: %s", wf_id, job_id, exc, exc_info=True)
        db.rollback()
        db.execute(
            text("""
                UPDATE workflow_runs SET status='failed', error_message=:err, completed_at=:t
                WHERE id=:id
            """),
            {"err": str(exc), "t": now(), "id": wf_id},
        )
        db.commit()
    finally:
        db.close()


async def _renew_lock_periodically(receiver, msg, interval: int = 30):
    """Renew the Service Bus message lock every interval seconds.

    Contact discovery can take several minutes (multiple Apify calls), so the
    default 60s lock would expire without this.
    """
    try:
        while True:
            await asyncio.sleep(interval)
            await receiver.renew_message_lock(msg)
            logger.debug("Renewed message lock for contact-discovery message")
    except asyncio.CancelledError:
        pass
    except Exception as exc:
        logger.warning("Failed to renew message lock: %s", exc)


async def listen():
    logger.info("Listening on queue: %s", QUEUE_NAME)
    async with ServiceBusClient.from_connection_string(settings.SERVICE_BUS_CONNECTION_STRING) as sb:
        async with sb.get_queue_receiver(queue_name=QUEUE_NAME) as receiver:
            async for msg in receiver:
                renew_task = asyncio.create_task(_renew_lock_periodically(receiver, msg))
                try:
                    await _process(json.loads(str(msg)))
                    await receiver.complete_message(msg)
                except Exception as exc:
                    logger.error("Message processing error: %s", exc, exc_info=True)
                    try:
                        await receiver.abandon_message(msg)
                    except Exception:
                        pass  # lock may have already expired
                finally:
                    renew_task.cancel()
