"""add ref_chat_messages table for REF-13

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-05-08

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'l2m3n4o5p6q7'
down_revision = 'k1l2m3n4o5p6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'ref_chat_messages',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('contact_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('contacts.id', ondelete='CASCADE'),
                  nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id'), nullable=False),
        sa.Column('role', sa.String(length=10), nullable=False),
        sa.Column('kind', sa.String(length=30), nullable=False),
        sa.Column('content', postgresql.JSONB, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index(
        'ref_chat_messages_contact_id_idx',
        'ref_chat_messages',
        ['contact_id', 'created_at'],
    )


def downgrade() -> None:
    op.drop_index('ref_chat_messages_contact_id_idx', table_name='ref_chat_messages')
    op.drop_table('ref_chat_messages')
