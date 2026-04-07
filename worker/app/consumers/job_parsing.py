import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

import httpx
from azure.servicebus.aio import ServiceBusClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.integrations.ai_foundry import ai_foundry
from app.prompts.job_parsing import JOB_PARSING_SYSTEM_PROMPT
from app.prompts.company_research import COMPANY_RESEARCH_SYSTEM_PROMPT
from app.scraper import scrape, extract_domain, find_linkedin_url_from_homepage

logger = logging.getLogger(__name__)

QUEUE_NAME = "job-parsing"

_engine = create_engine(
    settings.DATABASE_URL,
    isolation_level="AUTOCOMMIT",
)
_Session = sessionmaker(bind=_engine)


async def _find_linkedin_url_via_apify(company_name: str, domain: str) -> str | None:
    """Search harvestapi/linkedin-company by name, validate result against domain."""
    headers = {"Authorization": f"Bearer {settings.APIFY_API_TOKEN}"}
    apify_base = "https://api.apify.com/v2"

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            r = await client.post(
                f"{apify_base}/acts/harvestapi~linkedin-company/runs",
                headers=headers,
                json={"companies": [company_name], "scrapeMode": "Short"},
            )
            r.raise_for_status()
            run_id = r.json()["data"]["id"]

            while True:
                await asyncio.sleep(5)
                r = await client.get(f"{apify_base}/actor-runs/{run_id}", headers=headers)
                r.raise_for_status()
                status = r.json()["data"]["status"]
                if status == "SUCCEEDED":
                    break
                if status in ("FAILED", "ABORTED", "TIMED-OUT"):
                    raise RuntimeError(f"Apify run failed: {status}")

            dataset_id = r.json()["data"]["defaultDatasetId"]
            r = await client.get(f"{apify_base}/datasets/{dataset_id}/items", headers=headers)
            r.raise_for_status()
            results = r.json()

        # Validate: find the result whose website domain matches our job domain
        for company in results:
            website = company.get("website") or ""
            website_domain = extract_domain(website)
            if domain and website_domain and (
                domain in website_domain or website_domain in domain
            ):
                linkedin_url = company.get("linkedinUrl") or company.get("url") or ""
                if "linkedin.com/company/" in linkedin_url:
                    logger.info(
                        "harvestapi matched company '%s' via domain %s → %s",
                        company.get("name"), domain, linkedin_url,
                    )
                    return linkedin_url.rstrip("/") + "/"

        logger.warning(
            "harvestapi returned %d results for '%s' but none matched domain '%s'",
            len(results), company_name, domain,
        )
    except Exception as exc:
        logger.warning("harvestapi company lookup failed for '%s': %s", company_name, exc)

    return None


async def _process(payload: dict):
    wf_id   = payload["workflow_run_id"]
    job_id  = uuid.UUID(payload["job_id"])
    user_id = payload["user_id"]
    url     = payload["url"]

    def now():
        return datetime.now(timezone.utc)

    db = _Session()
    try:
        db.execute(
            text("UPDATE workflow_runs SET status='running', started_at=:t WHERE id=:id"),
            {"t": now(), "id": wf_id},
        )

        page_text, company_linkedin_url = await scrape(url)
        logger.info("scraper: company_linkedin_url extracted: %s", company_linkedin_url)

        result = await ai_foundry.run_flow(
            system_prompt=JOB_PARSING_SYSTEM_PROMPT,
            user_message=page_text,
        )
        out = json.loads(result)

        if out.get("title") is not None:
            db.execute(
                text("""
                    UPDATE jobs SET
                        title                = :title,
                        company              = :company,
                        description          = :description,
                        location             = :location,
                        work_mode            = :work_mode,
                        role_family          = :role_family,
                        company_linkedin_url = :company_linkedin_url,
                        updated_at           = :t
                    WHERE id = :job_id
                """),
                {
                    "title":                out.get("title"),
                    "company":              out.get("company"),
                    "description":          out.get("description"),
                    "location":             out.get("location", ""),
                    "work_mode":            out.get("employment_type"),
                    "role_family":          out.get("seniority_level"),
                    "company_linkedin_url": company_linkedin_url,
                    "t":                    now(),
                    "job_id":               job_id,
                },
            )

        # --- Fallback: find company LinkedIn URL for non-LinkedIn job pages ---
        if not company_linkedin_url and out.get("company"):
            domain = extract_domain(url)
            if domain:
                logger.info("Non-LinkedIn URL — trying footer scrape for domain: %s", domain)
                company_linkedin_url = await find_linkedin_url_from_homepage(domain)

            if not company_linkedin_url:
                logger.info("Footer scrape failed — trying harvestapi/linkedin-company for: %s", out.get("company"))
                company_linkedin_url = await _find_linkedin_url_via_apify(
                    out.get("company", ""), domain
                )

            if company_linkedin_url:
                db.execute(
                    text("UPDATE jobs SET company_linkedin_url = :url WHERE id = :job_id"),
                    {"url": company_linkedin_url, "job_id": job_id},
                )
                logger.info("company_linkedin_url saved via fallback: %s", company_linkedin_url)
            else:
                logger.warning("Could not determine company LinkedIn URL for: %s", out.get("company"))

        job_exists = db.execute(
            text("SELECT 1 FROM jobs WHERE id = :job_id"),
            {"job_id": job_id},
        ).fetchone()

        try:
            if job_exists:
                db.execute(
                    text("""
                        INSERT INTO activity_log (id, job_id, user_id, action, created_at)
                        VALUES (:id, :job_id, :user_id, 'Job parsed by AI', :t)
                    """),
                    {"id": str(uuid.uuid4()), "job_id": job_id, "user_id": user_id, "t": now()},
                )
            else:
                logger.warning("job_id %s not found in jobs table — skipping activity_log insert", job_id)
        except Exception as log_exc:
            logger.warning("Failed to insert activity_log for job_id %s: %s", job_id, log_exc)

        # Company research
        company_result = await ai_foundry.run_flow(
            system_prompt=COMPANY_RESEARCH_SYSTEM_PROMPT,
            user_message=f"Company: {out.get('company')}\nJob Title: {out.get('title')}",
        )
        company_data = json.loads(company_result)

        db.execute(
            text("""
                UPDATE jobs SET company_research = :research, updated_at = :t
                WHERE id = :job_id
            """),
            {"research": json.dumps(company_data), "t": now(), "job_id": job_id},
        )

        db.execute(
            text("""
                INSERT INTO activity_log (id, job_id, user_id, action, created_at)
                VALUES (:id, :job_id, :user_id, 'Company research completed by AI', :t)
            """),
            {"id": str(uuid.uuid4()), "job_id": job_id, "user_id": user_id, "t": now()},
        )

        db.execute(
            text("""
                UPDATE workflow_runs SET status='completed', completed_at=:t, output_data=:out
                WHERE id=:id
            """),
            {"t": now(), "out": json.dumps(out), "id": wf_id},
        )
        db.commit()

    except Exception as exc:
        logger.error("job_parsing failed: %s", exc, exc_info=True)
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
