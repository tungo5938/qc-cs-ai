"""add allowed_emails table for Google OAuth access control

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'allowed_emails',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('email', sa.Text, nullable=False, unique=True),
        sa.Column('added_by', sa.Text, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade():
    op.drop_table('allowed_emails')
