import json
import uuid
import logging
from sqlalchemy.orm import Session
from azure.servicebus import ServiceBusClient, ServiceBusMessage
from app.core.config import settings
from app.db.models.job import WorkflowRun

logger = logging.getLogger(__name__)


def _publish(queue_name: str, payload: dict, db: Session, user_id: uuid.UUID, job_id: uuid.UUID | None = None) -> WorkflowRun:
    """
    Creates a WorkflowRun row (status='queued') and publishes a message to
    the given Azure Service Bus queue. Returns the WorkflowRun.
    """
    run = WorkflowRun(
        user_id=user_id,
        job_id=job_id,
        type=queue_name,
        status="queued",
        input_data=payload,
    )
    db.add(run)
    db.flush()  # get run.id before committing
    db.commit()  # commit workflow_run before publishing so worker can query it

    # Inject workflow_run_id into the message
    message_body = {**payload, "workflow_run_id": str(run.id)}

    try:
        with ServiceBusClient.from_connection_string(settings.SERVICE_BUS_CONNECTION_STRING) as client:
            with client.get_queue_sender(queue_name) as sender:
                sender.send_messages(ServiceBusMessage(json.dumps(message_body)))
        logger.info(f"Published to {queue_name}: workflow_run_id={run.id}")
    except Exception as e:
        logger.error(f"Failed to publish to {queue_name}: {e}")
        run.status = "failed"
        run.error_message = f"Failed to publish to queue: {e}"
        db.commit()

    db.refresh(run)
    return run


def publish_job_parsing(db: Session, user_id: uuid.UUID, job_id: uuid.UUID, url: str) -> WorkflowRun:
    return _publish(
        queue_name="job-parsing",
        payload={"user_id": str(user_id), "job_id": str(job_id), "url": url},
        db=db,
        user_id=user_id,
        job_id=job_id,
    )


def publish_contact_discovery(
    db: Session,
    user_id: uuid.UUID,
    job_id: uuid.UUID,
    batch_number: int = 1,
    round_number: int = 1,
) -> WorkflowRun:
    return _publish(
        queue_name="contact-discovery",
        payload={
            "user_id": str(user_id),
            "job_id": str(job_id),
            "batch_number": batch_number,
            "round_number": round_number,
        },
        db=db,
        user_id=user_id,
        job_id=job_id,
    )
