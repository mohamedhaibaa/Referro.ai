import asyncio
import logging
from datetime import datetime, timezone, timedelta

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

logger = logging.getLogger(__name__)

_engine = create_engine(settings.DATABASE_URL, isolation_level="AUTOCOMMIT")
_Session = sessionmaker(bind=_engine)


async def run_cleanup():
    """Periodic data cleanup. Runs once at startup then every 24 hours.

    Policies:
    - contacts.profile_data: nullified after 30 days (status-change nullification
      is handled separately in the backend PATCH /jobs/{id} endpoint)
    - workflow_runs: deleted after 30 days (90 days for failed runs)
    """
    while True:
        logger.info("cleanup: starting periodic run")
        db = _Session()
        try:
            cutoff_30 = datetime.now(timezone.utc) - timedelta(days=30)
            cutoff_90 = datetime.now(timezone.utc) - timedelta(days=90)

            result = db.execute(
                text("""
                    UPDATE contacts
                    SET profile_data = NULL
                    WHERE profile_data IS NOT NULL
                      AND created_at < :cutoff
                """),
                {"cutoff": cutoff_30},
            )
            logger.info("cleanup: nullified profile_data on %d contacts", result.rowcount)

            result = db.execute(
                text("""
                    DELETE FROM workflow_runs
                    WHERE status != 'failed'
                      AND created_at < :cutoff
                """),
                {"cutoff": cutoff_30},
            )
            logger.info("cleanup: deleted %d completed workflow_runs (>30d)", result.rowcount)

            result = db.execute(
                text("""
                    DELETE FROM workflow_runs
                    WHERE status = 'failed'
                      AND created_at < :cutoff
                """),
                {"cutoff": cutoff_90},
            )
            logger.info("cleanup: deleted %d failed workflow_runs (>90d)", result.rowcount)

        except Exception as exc:
            logger.error("cleanup: run failed: %s", exc, exc_info=True)
        finally:
            db.close()

        await asyncio.sleep(86400)  # run again in 24 hours
