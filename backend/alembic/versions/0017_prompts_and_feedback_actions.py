"""add prompt columns to products and source_feedback_id to action_items

Revision ID: 0017
Revises: 0016
Create Date: 2026-04-17
"""
from alembic import op
import sqlalchemy as sa

revision = '0017'
down_revision = '0016'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('products', sa.Column('root_cause_prompt', sa.Text(), nullable=True))
    op.add_column('products', sa.Column('solution_hint_prompt', sa.Text(), nullable=True))
    op.add_column('action_items', sa.Column('source_feedback_id', sa.String(36), nullable=True))
    op.create_foreign_key(
        'fk_action_items_source_feedback_id',
        'action_items', 'feedbacks',
        ['source_feedback_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade():
    op.drop_constraint('fk_action_items_source_feedback_id', 'action_items', type_='foreignkey')
    op.drop_column('action_items', 'source_feedback_id')
    op.drop_column('products', 'solution_hint_prompt')
    op.drop_column('products', 'root_cause_prompt')
