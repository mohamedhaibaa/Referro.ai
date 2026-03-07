import logging

logger = logging.getLogger(__name__)

QUEUE_NAME = "contact-discovery"


async def listen():
    """
    Listens on the contact-discovery Service Bus queue.

    Expected message payload:
    {
        "workflow_run_id": "uuid",
        "user_id": "uuid",
        "job_id": "uuid"
    }

    Steps:
    1. Update workflow_runs.status = 'running'
    2. Call AI Foundry Contact Discovery prompt flow
    3. Write discovered contacts to contacts table
    4. Insert activity_log row
    5. Update workflow_runs.status = 'completed'
    """
    logger.info(f"Listening on queue: {QUEUE_NAME}")
    # TODO: connect to Azure Service Bus and start consuming
