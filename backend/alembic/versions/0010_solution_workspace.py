"""add solution workspace columns

Revision ID: 0010
Revises: 0009
Create Date: 2026-04-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('solution_drafts', sa.Column('prd_content', postgresql.JSONB(), nullable=True))
    op.add_column('solution_drafts', sa.Column('tldraw_data', postgresql.JSONB(), nullable=True))
    op.add_column('solution_drafts', sa.Column('jira_epic_key', sa.Text(), nullable=True))
    op.add_column('solution_drafts', sa.Column('solution_chat_history', postgresql.JSONB(), nullable=True, server_default='[]'))


def downgrade():
    op.drop_column('solution_drafts', 'solution_chat_history')
    op.drop_column('solution_drafts', 'jira_epic_key')
    op.drop_column('solution_drafts', 'tldraw_data')
    op.drop_column('solution_drafts', 'prd_content')
