"""add connected_at to contacts (REF-28: new lifecycle state)

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-05-13

"""
from alembic import op
import sqlalchemy as sa

revision = 'm3n4o5p6q7r8'
down_revision = 'l2m3n4o5p6q7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'contacts',
        sa.Column('connected_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('contacts', 'connected_at')
