"""add user_profiles table (REF-33a: resume upload + parsing)

Revision ID: o5p6q7r8s9t0
Revises: n4o5p6q7r8s9
Create Date: 2026-05-18

One-to-one with users (unique constraint on user_id +
ondelete=CASCADE so removing a user removes their profile).

target_roles + target_companies columns are provisioned but
unused in REF-33a (DQ-C — REF-33a does not extract these from
resume; a future onboarding-question ticket will populate them
via PATCH without a migration).
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'o5p6q7r8s9t0'
down_revision = 'n4o5p6q7r8s9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'user_profiles',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'user_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            unique=True, nullable=False,
        ),
        # Raw resume reference
        sa.Column('resume_blob_path', sa.Text(), nullable=True),
        sa.Column('resume_filename', sa.String(length=255), nullable=True),
        sa.Column('resume_uploaded_at', sa.DateTime(timezone=True), nullable=True),
        # Parsed structured fields
        sa.Column('skills', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('experience_years', sa.Integer(), nullable=True),
        sa.Column('experience_summary', sa.Text(), nullable=True),
        sa.Column('education', sa.Text(), nullable=True),
        sa.Column('job_titles_history', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('target_roles', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('target_companies', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('raw_resume_text', sa.Text(), nullable=True),
        # Audit / eval
        sa.Column('parse_raw_response', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('user_edited_fields', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column(
            'created_at', sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text('now()'),
        ),
        sa.Column(
            'updated_at', sa.DateTime(timezone=True),
            nullable=False, server_default=sa.text('now()'),
        ),
    )
    op.create_index(
        'user_profiles_user_id_idx',
        'user_profiles', ['user_id'],
    )


def downgrade() -> None:
    op.drop_index('user_profiles_user_id_idx', table_name='user_profiles')
    op.drop_table('user_profiles')
