"""placeholder for manually applied migration

Revision ID: a476a52207e1
Revises: d4e5f6a7b8c9
Create Date: 2026-04-12

This migration was applied directly to the database without being committed to git.
This placeholder file exists solely to satisfy Alembic's revision chain.
"""
from alembic import op

revision = 'a476a52207e1'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
