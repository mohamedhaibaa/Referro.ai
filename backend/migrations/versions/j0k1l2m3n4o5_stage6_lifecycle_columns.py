"""stage 6: contact lifecycle columns + activity_log contact linkage

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-04-18

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'j0k1l2m3n4o5'
down_revision = 'i9j0k1l2m3n4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # contacts: post-reply lifecycle timestamps + outcome
    op.add_column('contacts', sa.Column('coffee_chat_scheduled_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('contacts', sa.Column('coffee_chat_completed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('contacts', sa.Column('interview_scheduled_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('contacts', sa.Column('interview_completed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('contacts', sa.Column('outcome', sa.String(length=20), nullable=True))
    op.add_column('contacts', sa.Column('outcome_recorded_at', sa.DateTime(timezone=True), nullable=True))

    # activity_log: contact linkage + type classifier
    op.add_column('activity_log', sa.Column('contact_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contacts.id'), nullable=True))
    op.add_column('activity_log', sa.Column('type', sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column('activity_log', 'type')
    op.drop_column('activity_log', 'contact_id')
    op.drop_column('contacts', 'outcome_recorded_at')
    op.drop_column('contacts', 'outcome')
    op.drop_column('contacts', 'interview_completed_at')
    op.drop_column('contacts', 'interview_scheduled_at')
    op.drop_column('contacts', 'coffee_chat_completed_at')
    op.drop_column('contacts', 'coffee_chat_scheduled_at')
