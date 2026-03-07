import logging

logger = logging.getLogger(__name__)

QUEUE_NAME = "flash-card-generation"


async def listen():
    """
    Expected payload: { workflow_run_id, user_id, job_id }
    Calls AI Foundry Flash Card Generation flow, writes to flash_cards table.
    """
    logger.info(f"Listening on queue: {QUEUE_NAME}")
    # TODO: implement
