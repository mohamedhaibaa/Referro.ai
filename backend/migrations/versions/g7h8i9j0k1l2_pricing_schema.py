"""pricing schema: batch_number, round_number, credits, credit_transactions

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-04-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'g7h8i9j0k1l2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # contacts: add batch_number and round_number
    op.add_column('contacts', sa.Column('batch_number', sa.Integer(), nullable=True))
    op.add_column('contacts', sa.Column('round_number', sa.Integer(), nullable=False,
                  server_default=sa.text('1')))

    # users: add credit columns and plan tier
    op.add_column('users', sa.Column('credits_remaining',
                  sa.Numeric(precision=6, scale=1), nullable=False,
                  server_default=sa.text('0')))
    op.add_column('users', sa.Column('credits_total',
                  sa.Numeric(precision=6, scale=1), nullable=False,
                  server_default=sa.text('0')))
    op.add_column('users', sa.Column('plan_tier', sa.String(length=20),
                  nullable=False, server_default=sa.text("'trial'")))

    # credit_transactions table
    op.create_table(
        'credit_transactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('users.id'), nullable=False),
        sa.Column('job_id', postgresql.UUID(as_uuid=True),
                  sa.ForeignKey('jobs.id'), nullable=True),
        sa.Column('amount', sa.Numeric(precision=6, scale=1), nullable=False),
        sa.Column('transaction_type', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('NOW()'), nullable=False),
    )
    op.create_index('credit_tx_user_id_idx', 'credit_transactions', ['user_id'])


def downgrade() -> None:
    op.drop_index('credit_tx_user_id_idx', table_name='credit_transactions')
    op.drop_table('credit_transactions')
    op.drop_column('users', 'plan_tier')
    op.drop_column('users', 'credits_total')
    op.drop_column('users', 'credits_remaining')
    op.drop_column('contacts', 'round_number')
    op.drop_column('contacts', 'batch_number')
