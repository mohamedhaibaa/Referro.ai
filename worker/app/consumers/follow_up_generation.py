import logging

logger = logging.getLogger(__name__)

QUEUE_NAME = "follow-up-generation"


async def listen():
    """
    Expected payload: { workflow_run_id, user_id, job_id, outreach_message_id }
    Calls AI Foundry Follow-Up Generation flow, writes to follow_ups table.
    """
    logger.info(f"Listening on queue: {QUEUE_NAME}")
    # TODO: implement
