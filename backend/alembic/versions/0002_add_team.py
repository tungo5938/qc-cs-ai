"""add team to issues

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE teamtype AS ENUM ('cs_b2c', 'cs_c2c', 'telesales', 'unknown')")
    op.add_column(
        "issues",
        sa.Column(
            "team",
            sa.Enum("cs_b2c", "cs_c2c", "telesales", "unknown", name="teamtype"),
            nullable=False,
            server_default="unknown",
        ),
    )


def downgrade() -> None:
    op.drop_column("issues", "team")
    op.execute("DROP TYPE teamtype")
