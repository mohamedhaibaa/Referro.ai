"""alter contacts table for contact discovery

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old columns
    op.drop_column('contacts', 'name')
    op.drop_column('contacts', 'relationship')
    op.drop_column('contacts', 'confidence')
    op.drop_column('contacts', 'source')
    op.drop_column('contacts', 'profile_url')
    op.drop_column('contacts', 'is_selected')

    # Add new columns
    op.add_column('contacts', sa.Column('full_name', sa.String(length=255), nullable=True))
    op.add_column('contacts', sa.Column('linkedin_url', sa.Text(), nullable=True))
    op.add_column('contacts', sa.Column('company', sa.String(length=255), nullable=True))
    op.add_column('contacts', sa.Column('location', sa.String(length=255), nullable=True))
    op.add_column('contacts', sa.Column('university', sa.String(length=255), nullable=True))
    op.add_column('contacts', sa.Column('tenure_months', sa.Integer(), nullable=True))
    op.add_column('contacts', sa.Column('relevance_score', sa.Integer(), nullable=True))
    op.add_column('contacts', sa.Column('profile_data', sa.Text(), nullable=True))

    # title: change from NOT NULL to nullable
    op.alter_column('contacts', 'title', existing_type=sa.String(length=255), nullable=True)


def downgrade() -> None:
    op.alter_column('contacts', 'title', existing_type=sa.String(length=255), nullable=False)

    op.drop_column('contacts', 'profile_data')
    op.drop_column('contacts', 'relevance_score')
    op.drop_column('contacts', 'tenure_months')
    op.drop_column('contacts', 'university')
    op.drop_column('contacts', 'location')
    op.drop_column('contacts', 'company')
    op.drop_column('contacts', 'linkedin_url')
    op.drop_column('contacts', 'full_name')

    op.add_column('contacts', sa.Column('is_selected', sa.Boolean(), nullable=False, server_default=sa.text('false')))
    op.add_column('contacts', sa.Column('profile_url', sa.Text(), nullable=True))
    op.add_column('contacts', sa.Column('source', sa.String(length=100), nullable=False, server_default=sa.text("''")))
    op.add_column('contacts', sa.Column('confidence', sa.String(length=10), nullable=False, server_default=sa.text("''")))
    op.add_column('contacts', sa.Column('relationship', sa.String(length=50), nullable=False, server_default=sa.text("''")))
    op.add_column('contacts', sa.Column('name', sa.String(length=255), nullable=False, server_default=sa.text("''")))
