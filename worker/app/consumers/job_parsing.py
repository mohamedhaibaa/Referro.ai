import json
import logging
import uuid
from datetime import datetime, timezone

import httpx
from azure.servicebus.aio import ServiceBusClient
from bs4 import BeautifulSoup
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.integrations.ai_foundry import ai_foundry
from app.prompts.job_parsing import JOB_PARSING_SYSTEM_PROMPT

logger = logging.getLogger(__name__)

QUEUE_NAME = "job-parsing"

_engine = create_engine(settings.DATABASE_URL)
_Session = sessionmaker(bind=_engine)


async def _scrape(url: str) -> str:
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as c:
        r = await c.get(url, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header"]):
        tag.decompose()
    return soup.get_text(separator=" ", strip=True)[:8000]


async def _process(payload: dict):
    wf_id   = payload["workflow_run_id"]
    job_id  = payload["job_id"]
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
        db.commit()

        page_text = await _scrape(url)

        result = await ai_foundry.run_flow(
            system_prompt=JOB_PARSING_SYSTEM_PROMPT,
            user_message=page_text,
        )
        out = json.loads(result)

        db.execute(
            text("""
                UPDATE jobs SET
                    title       = COALESCE(:title,       title),
                    company     = COALESCE(:company,     company),
                    description = COALESCE(:description, description),
                    work_mode   = COALESCE(:work_mode,   work_mode),
                    role_family = COALESCE(:role_family, role_family),
                    updated_at  = :t
                WHERE id = :job_id
            """),
            {
                "title":       out.get("title"),
                "company":     out.get("company"),
                "description": out.get("description"),
                "work_mode":   out.get("employment_type"),
                "role_family": out.get("seniority_level"),
                "t":           now(),
                "job_id":      job_id,
            },
        )

        db.execute(
            text("""
                INSERT INTO activity_log (id, job_id, user_id, action, created_at)
                VALUES (:id, :job_id, :user_id, 'Job parsed by AI', :t)
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
