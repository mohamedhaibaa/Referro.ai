import logging

logger = logging.getLogger(__name__)

QUEUE_NAME = "pitch-deck-generation"


async def listen():
    """
    Expected payload: { workflow_run_id, user_id, job_id }
    Steps:
    1. Call AI Foundry Pitch Deck Content flow
    2. Send structured content to Gamma API
    3. Store Gamma deck URL in pitch_decks table
    4. Upload any outputs to Blob Storage (ai-outputs container)
    """
    logger.info(f"Listening on queue: {QUEUE_NAME}")
    # TODO: implement
