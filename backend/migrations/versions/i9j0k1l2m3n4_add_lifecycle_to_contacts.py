"""add lifecycle_status + replied_at to contacts

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-04-17

"""
from alembic import op
import sqlalchemy as sa

revision = 'i9j0k1l2m3n4'
down_revision = 'h8i9j0k1l2m3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'contacts',
        sa.Column('lifecycle_status', sa.String(length=40), nullable=False,
                  server_default=sa.text("'not_contacted'")),
    )
    op.add_column(
        'contacts',
        sa.Column('replied_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('contacts', 'replied_at')
    op.drop_column('contacts', 'lifecycle_status')
