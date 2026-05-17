"""add contact_replies table (REF-30: capture + classify replies)

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
Create Date: 2026-05-17

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'n4o5p6q7r8s9'
down_revision = 'm3n4o5p6q7r8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'contact_replies',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'contact_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('contacts.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column(
            'user_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id'),
            nullable=False,
        ),
        sa.Column('reply_text', sa.Text(), nullable=False),
        sa.Column('classified_intent', sa.String(length=40), nullable=True),
        sa.Column('classification_confidence', sa.String(length=10), nullable=True),
        sa.Column('extracted_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('raw_ai_response', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            'created_at', sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text('now()'),
        ),
    )
    op.create_index(
        'contact_replies_contact_id_idx',
        'contact_replies', ['contact_id', 'created_at'],
    )


def downgrade() -> None:
    op.drop_index('contact_replies_contact_id_idx', table_name='contact_replies')
    op.drop_table('contact_replies')
