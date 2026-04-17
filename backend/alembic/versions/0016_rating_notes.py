"""add rating note fields to feedbacks

Revision ID: 0016
Revises: 0015
Create Date: 2026-04-17
"""
from alembic import op
import sqlalchemy as sa

revision = '0016'
down_revision = '0015'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('feedbacks', sa.Column('user_priority_note', sa.Text(), nullable=True))
    op.add_column('feedbacks', sa.Column('tu_danh_gia_note', sa.Text(), nullable=True))
    op.add_column('feedbacks', sa.Column('tech_rating_note', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('feedbacks', 'tech_rating_note')
    op.drop_column('feedbacks', 'tu_danh_gia_note')
    op.drop_column('feedbacks', 'user_priority_note')
