"""add solution_hint and acceptance_criteria to feedback_analyses

Revision ID: 0014
Revises: 0013
Create Date: 2026-04-16
"""
from alembic import op
import sqlalchemy as sa

revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('feedback_analyses', sa.Column('solution_hint', sa.Text(), nullable=True))
    op.add_column('feedback_analyses', sa.Column('acceptance_criteria', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('feedback_analyses', 'acceptance_criteria')
    op.drop_column('feedback_analyses', 'solution_hint')
