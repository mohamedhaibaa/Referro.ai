"""add company_research to jobs

Revision ID: a1b2c3d4e5f6
Revises: 3fdbe56b0709
Create Date: 2026-03-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '3fdbe56b0709'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('jobs', sa.Column('company_research', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('jobs', 'company_research')
