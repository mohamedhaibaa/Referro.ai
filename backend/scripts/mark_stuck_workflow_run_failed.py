"""One-off cleanup script for REF-26.

Usage:
    cd backend
    source venv/bin/activate
    python -m scripts.mark_stuck_workflow_run_failed <workflow_run_uuid>

Marks a single stuck workflow_run (status='queued' or 'running') as
'failed' with an explanatory error_message and completed_at=now().
Idempotent: no-op if the row is already terminal or not found.

Used initially against id 72fa78d8-191d-4c0d-b54b-dc355f050550, which
sat at status='queued' indefinitely because the worker never picked it
up (root cause is a separate future ticket — Service Bus / worker
investigation).
"""
import sys
import uuid
from datetime import datetime, timezone

from app.db.models.job import WorkflowRun
from app.db.session import SessionLocal

TERMINAL_STATUSES = {"completed", "failed"}
ERROR_MESSAGE = "Marked failed via REF-26 cleanup — worker never picked up"


def main(workflow_run_id: str) -> int:
    try:
        run_uuid = uuid.UUID(workflow_run_id)
    except ValueError:
        print(f"ERROR: not a valid UUID: {workflow_run_id!r}")
        return 2

    db = SessionLocal()
    try:
        run = db.query(WorkflowRun).filter(WorkflowRun.id == run_uuid).first()
        if run is None:
            print(f"NOT FOUND: no workflow_run with id {workflow_run_id}")
            return 0
        if run.status in TERMINAL_STATUSES:
            print(f"ALREADY TERMINAL: id={workflow_run_id} status={run.status!r}, no change")
            return 0

        old_status = run.status
        run.status = "failed"
        run.error_message = ERROR_MESSAGE
        run.completed_at = datetime.now(timezone.utc)
        db.commit()
        print(
            f"UPDATED: id={workflow_run_id} status {old_status!r} -> 'failed', "
            f"error_message set, completed_at=now()"
        )
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python -m scripts.mark_stuck_workflow_run_failed <workflow_run_uuid>")
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
