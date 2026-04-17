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
    "Scoring criteria (apply ALL that match, scores are additive): "
    "- Same or very similar role/function as the job (e.g. both are developers, both are designers, both are marketers): +45 points. "
    "  This is the MOST important signal. A 'Staff Developer' is the same function as a 'Software Developer' posting. "
    "  An 'Account Manager' is NOT the same function as a 'Developer' posting. "
    "- Recruiter, HR, or Talent Acquisition role: +40 points (always high priority regardless of department) "
    "- Direct manager or team lead of the role's department: +25 points "
    "- Located in same city as job: +15 points "
    "- Tenure 0-18 months at company (recently joined, can share interview tips): +10 points "
    "- Same university as candidate: +20 points "
    "- Completely unrelated department (e.g. sales person for an engineering role): -20 points "
    "- Tenure over 10 years: -10 points "
    "- C-suite (CEO, CTO, CFO, etc.): -15 points (too senior to reach out to) "
    "Important: Contacts in the SAME function as the job should almost always score highest. "
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


_STOP_WORDS = {
    "and", "or", "the", "a", "an", "of", "in", "at", "for", "to", "with",
    "on", "is", "be", "are", "was", "were", "by", "as", "it", "its",
    "entry", "level", "senior", "junior", "lead", "associate", "staff",
    "consultant", "specialist", "analyst", "officer", "head", "global",
    "north", "south", "east", "west", "americas", "canada", "us", "usa",
}

def _extract_role_keywords(job_title: str) -> str:
    """Extract meaningful keywords from a job title for LinkedIn employee search.

    Strips seniority/level words and common filler words, returns the 3 most
    meaningful terms joined by space (LinkedIn treats this as OR search).
    """
    words = re.findall(r"[a-zA-Z]+", job_title)
    keywords = [w for w in words if w.lower() not in _STOP_WORDS and len(w) > 2]
    return " ".join(keywords[:3]) if keywords else job_title


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
    batch_number = int(payload.get("batch_number", 1))
    round_number = int(payload.get("round_number", 1))

    def now():
        return datetime.now(timezone.utc)

    db = _Session()
    try:
        # --- Step 0: Setup ---
        db.execute(
            text("UPDATE workflow_runs SET status='running', started_at=:t WHERE id=:id"),
            {"t": now(), "id": wf_id},
        )

        # Idempotency: skip if contacts already exist for this batch + round
        already_saved = db.execute(
            text("""
                SELECT COUNT(*) FROM contacts
                WHERE job_id = :job_id AND user_id = :user_id
                  AND batch_number = :batch_number AND round_number = :round_number
            """),
            {"job_id": job_id, "user_id": user_id, "batch_number": batch_number, "round_number": round_number},
        ).scalar()
        if already_saved:
            logger.info(
                "Idempotency: contacts already exist for batch=%d round=%d — skipping Apify call",
                batch_number, round_number,
            )
            db.execute(
                text("UPDATE workflow_runs SET status='completed', completed_at=:t, output_data=:out WHERE id=:id"),
                {"t": now(), "out": json.dumps({"contacts_saved": 0, "skipped": True}), "id": wf_id},
            )
            db.commit()
            return

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
        role_keywords = _extract_role_keywords(job_title)

        # Build title keywords: role-relevant terms + always-present decision maker titles.
        # titleKeywords uses strict matching — keep terms broad (single words or short phrases).
        role_terms = [w for w in re.findall(r"[a-zA-Z]+", job_title)
                      if w.lower() not in _STOP_WORDS and len(w) > 3][:3]
        title_keywords = role_terms + ["Recruiter", "Talent Acquisition", "HR", "Manager", "Director"]

        start_page = (round_number - 1) * 3 + batch_number
        run_input = {
            "companies": [linkedin_company_url],
            "profileScraperMode": "Full ($8 per 1k)",
            "maxItems": 4,
            "startPage": start_page,
            "titleKeywords": title_keywords,
        }
        logger.info("Apify startPage=%d (batch=%d round=%d)", start_page, batch_number, round_number)
        if city:
            run_input["locations"] = [city]

        async with httpx.AsyncClient(timeout=180.0) as client:
            profiles = await _apify_run(
                client, "harvestapi~linkedin-company-employees", run_input,
            )

        logger.info(
            "Apify returned %d profiles for company %s (titleKeywords: %s)",
            len(profiles), job_company, title_keywords,
        )
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

        # --- Step 3: Save to DB ---
        # Batch 1 round 1: clear all existing contacts for a fresh campaign start
        if batch_number == 1 and round_number == 1:
            db.execute(
                text("DELETE FROM contacts WHERE job_id = :job_id AND user_id = :user_id"),
                {"job_id": job_id, "user_id": user_id},
            )

        # De-duplicate against existing contacts for this job
        existing_urls = {
            row[0] for row in db.execute(
                text("SELECT linkedin_url FROM contacts WHERE job_id = :job_id AND user_id = :user_id"),
                {"job_id": job_id, "user_id": user_id},
            ).fetchall()
        }
        active_profiles = [p for p in active_profiles if p.get("linkedinUrl", "") not in existing_urls]
        logger.info("After dedup against existing contacts: %d active remain", len(active_profiles))

        active_profiles.sort(
            key=lambda p: score_map.get(p.get("linkedinUrl", ""), 0),
            reverse=True,
        )
        top3 = active_profiles[:3]
        logger.info(
            "Top contacts for batch %d: %s",
            batch_number,
            [(p.get("linkedinUrl", ""), score_map.get(p.get("linkedinUrl", ""), 0)) for p in top3],
        )

        logger.info("Saving %d contacts to DB for job_id=%s (batch=%d round=%d)", len(top3), job_id, batch_number, round_number)
        for i, profile in enumerate(top3):
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
                "batch_number": batch_number,
                "round_number": round_number,
                "t": now(),
            }
            logger.info(
                "Inserting contact %d/%d: full_name=%r title=%r score=%s batch=%d round=%d",
                i + 1, len(top3),
                contact_params["full_name"],
                contact_params["title"],
                contact_params["relevance_score"],
                contact_params["batch_number"],
                contact_params["round_number"],
            )

            db.execute(
                text("""
                    INSERT INTO contacts
                        (id, job_id, user_id, full_name, linkedin_url, title,
                         company, location, university, tenure_months,
                         relevance_score, profile_data, batch_number, round_number, created_at)
                    VALUES
                        (:id, :job_id, :user_id, :full_name, :linkedin_url, :title,
                         :company, :location, :university, :tenure_months,
                         :relevance_score, :profile_data, :batch_number, :round_number, :t)
                """),
                {**contact_params, "profile_data": json.dumps(profile)},
            )
            logger.info("Contact %d/%d inserted successfully: %r", i + 1, len(top3), full_name)

        db.commit()
        logger.info("Committed %d contacts to DB (batch=%d round=%d)", len(top3), batch_number, round_number)

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
                "out": json.dumps({"contacts_saved": len(top3), "batch_number": batch_number, "round_number": round_number}),
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
