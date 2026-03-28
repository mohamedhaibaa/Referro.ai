import json
import logging
import uuid
from datetime import datetime, timezone

from azure.servicebus.aio import ServiceBusClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.integrations.ai_foundry import ai_foundry
from app.prompts.job_parsing import JOB_PARSING_SYSTEM_PROMPT
from app.scraper import scrape

logger = logging.getLogger(__name__)

QUEUE_NAME = "job-parsing"

_engine = create_engine(
    settings.DATABASE_URL,
    isolation_level="AUTOCOMMIT",
)
_Session = sessionmaker(bind=_engine)


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

        page_text = await scrape(url)

        result = await ai_foundry.run_flow(
            system_prompt=JOB_PARSING_SYSTEM_PROMPT,
            user_message=page_text,
        )
        out = json.loads(result)

        if out.get("title") is not None:
            db.execute(
                text("""
                    UPDATE jobs SET
                        title       = :title,
                        company     = :company,
                        description = :description,
                        work_mode   = :work_mode,
                        role_family = :role_family,
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

        db.execute(
            text("""
                UPDATE workflow_runs SET status='completed', completed_at=:t, output_data=:out
                WHERE id=:id
            """),
            {"t": now(), "out": json.dumps(out), "id": wf_id},
        )

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
