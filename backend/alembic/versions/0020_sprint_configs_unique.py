"""add unique constraint on sprint_configs.product_id

Revision ID: 0020
Revises: 0019
Create Date: 2026-05-12
"""
from alembic import op

revision = '0020'
down_revision = '0019'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index(
        'uq_sprint_configs_product_id',
        'sprint_configs',
        ['product_id'],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index('uq_sprint_configs_product_id', 'sprint_configs')
