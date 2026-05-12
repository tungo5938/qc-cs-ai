"""add sprint_configs table

Revision ID: 0019
Revises: 0018
Create Date: 2026-05-08
"""
from alembic import op
import sqlalchemy as sa

revision = '0019'
down_revision = '0018'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'sprint_configs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('product_id', sa.String(36), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=True),
        sa.Column('anchor_date', sa.Date, nullable=False),
        sa.Column('sprint_length_weeks', sa.Integer, nullable=False, server_default='2'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_sprint_configs_product_id', 'sprint_configs', ['product_id'])


def downgrade() -> None:
    op.drop_index('ix_sprint_configs_product_id', 'sprint_configs')
    op.drop_table('sprint_configs')
