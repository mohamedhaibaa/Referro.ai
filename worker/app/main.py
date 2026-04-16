import asyncio
import logging
from app.consumers import (
    job_parsing,
    contact_discovery,
    outreach_generation,
    follow_up_generation,
    flash_card_generation,
    pitch_deck_generation,
    cleanup,
)

logging.basicConfig(level="INFO")
logger = logging.getLogger(__name__)


async def main():
    logger.info("Worker starting — listening on all queues")
    await asyncio.gather(
        job_parsing.listen(),
        contact_discovery.listen(),
        outreach_generation.listen(),
        follow_up_generation.listen(),
        flash_card_generation.listen(),
        pitch_deck_generation.listen(),
        cleanup.run_cleanup(),
    )


if __name__ == "__main__":
    asyncio.run(main())
