"""add roadmap_phases, roadmap_sprints tables and action_items roadmap FKs

Revision ID: 0021
Revises: 0020
Create Date: 2026-05-13
"""
from alembic import op
import sqlalchemy as sa

revision = '0021'
down_revision = '0020'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'roadmap_phases',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('product_id', sa.String(36), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('order_index', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_roadmap_phases_product_id', 'roadmap_phases', ['product_id'])

    op.create_table(
        'roadmap_sprints',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('phase_id', sa.String(36), sa.ForeignKey('roadmap_phases.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sprint_config_id', sa.String(36), sa.ForeignKey('sprint_configs.id', ondelete='SET NULL'), nullable=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('sprint_number', sa.Integer, nullable=True),
        sa.Column('start_date', sa.Date, nullable=True),
        sa.Column('end_date', sa.Date, nullable=True),
        sa.Column('order_index', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_roadmap_sprints_phase_id', 'roadmap_sprints', ['phase_id'])

    op.add_column('action_items', sa.Column('phase_id', sa.String(36), sa.ForeignKey('roadmap_phases.id', ondelete='SET NULL'), nullable=True))
    op.add_column('action_items', sa.Column('sprint_id', sa.String(36), sa.ForeignKey('roadmap_sprints.id', ondelete='SET NULL'), nullable=True))


def downgrade() -> None:
    op.drop_column('action_items', 'sprint_id')
    op.drop_column('action_items', 'phase_id')
    op.drop_index('ix_roadmap_sprints_phase_id', 'roadmap_sprints')
    op.drop_table('roadmap_sprints')
    op.drop_index('ix_roadmap_phases_product_id', 'roadmap_phases')
    op.drop_table('roadmap_phases')
