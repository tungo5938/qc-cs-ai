"""add product KB, goal, sheet URL, and feedback sheet columns

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-08
"""
from alembic import op
import sqlalchemy as sa

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns to products table
    op.add_column(
        "products",
        sa.Column("product_goal", sa.Text, nullable=True),
    )
    op.add_column(
        "products",
        sa.Column("kb_text", sa.Text, nullable=True),
    )
    op.add_column(
        "products",
        sa.Column("google_sheet_url", sa.Text, nullable=True),
    )

    # Add columns to feedbacks table
    op.add_column(
        "feedbacks",
        sa.Column("gsheet_row_index", sa.Integer, nullable=True),
    )
    op.add_column(
        "feedbacks",
        sa.Column("user_priority", sa.Integer, nullable=True),
    )
    op.add_column(
        "feedbacks",
        sa.Column("tech_rating", sa.Integer, nullable=True),
    )


def downgrade() -> None:
    # Drop columns from feedbacks table
    op.drop_column("feedbacks", "tech_rating")
    op.drop_column("feedbacks", "user_priority")
    op.drop_column("feedbacks", "gsheet_row_index")

    # Drop columns from products table
    op.drop_column("products", "google_sheet_url")
    op.drop_column("products", "kb_text")
    op.drop_column("products", "product_goal")
