from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


# Import all models so Alembic autogenerate picks them up
from app.db.models import user, job  # noqa: F401, E402
# All 16 tables: users, jobs, job_milestones, contacts, outreach_messages,
# follow_ups, notes, tags, job_tags, activity_log, pitch_decks, flash_cards,
# outcomes, resumes, inbox_items, workflow_runs
