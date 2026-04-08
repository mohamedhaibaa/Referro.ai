import logging

logger = logging.getLogger(__name__)

QUEUE_NAME = "outreach-generation"


async def listen():
    """
    Expected payload: { workflow_run_id, user_id, job_id, contact_id }
    Calls AI Foundry Outreach Generation flow, writes to outreach_messages table.
    """
    logger.info(f"Listening on queue: {QUEUE_NAME}")
    # TODO: implement
