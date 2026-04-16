"""widen work_mode and role_family to Text

Revision ID: f6a7b8c9d0e1
Revises: d4e5f6a7b8c9
Create Date: 2026-04-12

"""
from alembic import op
import sqlalchemy as sa

revision = 'f6a7b8c9d0e1'
down_revision = 'a476a52207e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('jobs', 'work_mode', type_=sa.Text(), existing_nullable=True)
    op.alter_column('jobs', 'role_family', type_=sa.Text(), existing_nullable=True)


def downgrade() -> None:
    op.alter_column('jobs', 'work_mode', type_=sa.String(20), existing_nullable=True)
    op.alter_column('jobs', 'role_family', type_=sa.String(20), existing_nullable=True)
