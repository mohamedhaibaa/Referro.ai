import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import text
from azure.servicebus.aio import ServiceBusClient

from app.core.config import settings
from app.db import SessionLocal

logger = logging.getLogger(__name__)

QUEUE_NAME = "job-parsing"

_SYSTEM_PROMPT = """You are a job posting parser. Given raw text scraped from a job posting page,
extract structured information and return ONLY valid JSON with exactly these keys:

{
  "title": "Job title (string)",
  "company": "Company name (string)",
  "description": "Full job description text (string)",
  "work_mode": "one of: remote | hybrid | onsite | null",
  "role_family": "one of: engineering | product | design | data | marketing | sales | operations | finance | legal | hr | other | null",
  "fit_score": "one of: high | medium | low | null"
}

Rules:
- If a field cannot be determined from the text, use null.
- description should include responsibilities, requirements, and any other relevant detail.
- Do not include any explanation or markdown — only the raw JSON object.
"""


async def _scrape_url(url: str) -> str:
    """Fetch a job posting URL and return cleaned plain text."""
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        )
    }
    async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")

    # Remove noise elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    raw = soup.get_text(separator="\n")
    lines = [line.strip() for line in raw.splitlines() if line.strip()]
    return "\n".join(lines)[:12000]  # cap to stay within token limits


async def _parse_with_ai(raw_text: str) -> dict:
    """Call Azure OpenAI to extract structured job data from raw page text."""
    url = (
        f"{settings.AI_FOUNDRY_ENDPOINT.rstrip('/')}"
        "/openai/deployments/gpt-4o/chat/completions?api-version=2024-02-01"
    )
    headers = {
        "Content-Type": "application/json",
        "api-key": settings.AI_FOUNDRY_API_KEY,
    }
    body = {
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": f"Parse this job posting:\n\n{raw_text}"},
        ],
        "temperature": 0,
        "max_tokens": 1000,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(url, headers=headers, json=body)
        response.raise_for_status()

    content = response.json()["choices"][0]["message"]["content"].strip()

    # Strip markdown code fences if the model wraps the output
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]

    return json.loads(content)


def _update_workflow_run(db, run_id: str, status: str, output: dict = None, error: str = None):
    now = datetime.now(timezone.utc)
    params: dict = {"status": status, "run_id": run_id, "now": now}

    set_clauses = ["status = :status"]
    if status == "running":
        set_clauses.append("started_at = :now")
    if status in ("completed", "failed"):
        set_clauses.append("completed_at = :now")
    if output is not None:
        set_clauses.append("output_data = :output::jsonb")
        params["output"] = json.dumps(output)
    if error is not None:
        set_clauses.append("error_message = :error")
        params["error"] = error

    db.execute(
        text(f"UPDATE workflow_runs SET {', '.join(set_clauses)} WHERE id = :run_id::uuid"),
        params,
    )
    db.commit()


def _update_job(db, job_id: str, parsed: dict):
    db.execute(
        text("""
            UPDATE jobs SET
                title       = CASE WHEN :title != '' THEN :title ELSE title END,
                company     = CASE WHEN :company != '' THEN :company ELSE company END,
                description = COALESCE(:description, description),
                work_mode   = COALESCE(:work_mode, work_mode),
                role_family = COALESCE(:role_family, role_family),
                fit_score   = COALESCE(:fit_score, fit_score),
                updated_at  = NOW()
            WHERE id = :job_id::uuid
        """),
        {
            "job_id": job_id,
            "title": parsed.get("title") or "",
            "company": parsed.get("company") or "",
            "description": parsed.get("description"),
            "work_mode": parsed.get("work_mode"),
            "role_family": parsed.get("role_family"),
            "fit_score": parsed.get("fit_score"),
        },
    )
    db.commit()


def _insert_activity(db, job_id: str, user_id: str, action: str):
    db.execute(
        text("""
            INSERT INTO activity_log (id, job_id, user_id, action, created_at)
            VALUES (:id::uuid, :job_id::uuid, :user_id::uuid, :action, NOW())
        """),
        {"id": str(uuid.uuid4()), "job_id": job_id, "user_id": user_id, "action": action},
    )
    db.commit()


async def _process_message(payload: dict):
    workflow_run_id = payload["workflow_run_id"]
    job_id = payload["job_id"]
    user_id = payload["user_id"]
    url = payload["url"]

    logger.info(f"[job-parsing] Starting: job_id={job_id} url={url}")

    db = SessionLocal()
    try:
        # 1. Mark as running
        _update_workflow_run(db, workflow_run_id, "running")

        # 2. Scrape the URL
        try:
            raw_text = await _scrape_url(url)
        except Exception as e:
            logger.error(f"[job-parsing] Scrape failed for {url}: {e}")
            _update_workflow_run(db, workflow_run_id, "failed", error=f"Failed to scrape URL: {e}")
            return

        # 3. Parse with AI
        try:
            parsed = await _parse_with_ai(raw_text)
        except Exception as e:
            logger.error(f"[job-parsing] AI parsing failed: {e}")
            _update_workflow_run(db, workflow_run_id, "failed", error=f"AI parsing failed: {e}")
            return

        # 4. Write parsed data back to the job row
        _update_job(db, job_id, parsed)

        # 5. Activity log
        _insert_activity(db, job_id, user_id, "Job details parsed by AI")

        # 6. Mark completed
        _update_workflow_run(db, workflow_run_id, "completed", output=parsed)

        logger.info(f"[job-parsing] Completed: job_id={job_id} title={parsed.get('title')!r}")

    except Exception as e:
        logger.exception(f"[job-parsing] Unexpected error: {e}")
        try:
            _update_workflow_run(db, workflow_run_id, "failed", error=str(e))
        except Exception:
            pass
    finally:
        db.close()


async def listen():
    """
    Listens on the job-parsing Service Bus queue.

    Message payload:
    {
        "workflow_run_id": "uuid",
        "user_id": "uuid",
        "job_id": "uuid",
        "url": "https://..."
    }

    Flow:
    1. Mark workflow_run as 'running'
    2. Scrape the job posting URL
    3. Send scraped text to Azure OpenAI (gpt-4o) for structured extraction
    4. Write title, company, description, work_mode, role_family, fit_score to jobs table
    5. Insert activity_log row
    6. Mark workflow_run as 'completed' (or 'failed' on any error)
    """
    logger.info(f"Listening on queue: {QUEUE_NAME}")

    async with ServiceBusClient.from_connection_string(settings.SERVICE_BUS_CONNECTION_STRING) as client:
        async with client.get_queue_receiver(QUEUE_NAME, max_wait_time=5) as receiver:
            while True:
                messages = await receiver.receive_messages(max_message_count=10, max_wait_time=5)

                for msg in messages:
                    try:
                        payload = json.loads(str(msg))
                        await _process_message(payload)
                        await receiver.complete_message(msg)
                    except Exception as e:
                        logger.error(f"[job-parsing] Failed to process message: {e}")
                        await receiver.abandon_message(msg)

                if not messages:
                    await asyncio.sleep(settings.WORKER_POLL_INTERVAL_SECONDS)
