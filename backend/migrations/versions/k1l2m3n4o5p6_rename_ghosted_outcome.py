"""rename contact outcome 'ghosted' to 'lost_touch'

Data migration only. No schema change — outcome is VARCHAR(20).
Stage 6.5 replaces the "ghosted" outcome with the semantically clearer
"lost_touch", which applies across multiple lifecycle states rather than
just the 2nd-follow-up case.

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-04-18

"""
from alembic import op

revision = 'k1l2m3n4o5p6'
down_revision = 'j0k1l2m3n4o5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE contacts SET outcome = 'lost_touch' WHERE outcome = 'ghosted'")


def downgrade() -> None:
    op.execute("UPDATE contacts SET outcome = 'ghosted' WHERE outcome = 'lost_touch'")
