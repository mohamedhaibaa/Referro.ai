import logging
import json

logger = logging.getLogger(__name__)

QUEUE_NAME = "job-parsing"


async def listen():
    """
    Listens on the job-parsing Service Bus queue.

    Expected message payload:
    {
        "workflow_run_id": "uuid",
        "user_id": "uuid",
        "job_id": "uuid",
        "url": "https://..."
    }

    Steps:
    1. Update workflow_runs.status = 'running'
    2. Call AI Foundry Job Parsing prompt flow with the URL
    3. Call AI Foundry Company Research prompt flow (chained)
    4. Write parsed job data back to jobs table
    5. Insert activity_log row: "Job parsed by AI"
    6. Update workflow_runs.status = 'completed'
    7. On any error: update status = 'failed', write error_message
    """
    logger.info(f"Listening on queue: {QUEUE_NAME}")
    # TODO: connect to Azure Service Bus and start consuming
