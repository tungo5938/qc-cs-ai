"""add scoring fields and config tables

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Scoring fields on issues
    op.add_column("issues", sa.Column("user_rating", sa.Float, nullable=True))
    op.add_column("issues", sa.Column("po_rating", sa.Float, nullable=True))
    op.add_column("issues", sa.Column("tech_effort", sa.Integer, nullable=True))
    op.add_column("issues", sa.Column("csat_score", sa.Float, nullable=True))
    op.add_column("issues", sa.Column("composite_score", sa.Float, nullable=True))
    op.add_column("issues", sa.Column("user_rating_by", sa.Text, nullable=True))
    op.add_column("issues", sa.Column("po_rating_by", sa.Text, nullable=True))
    op.add_column("issues", sa.Column("effort_set_by", sa.Text, nullable=True))

    # Scoring formula config (single row)
    op.create_table(
        "scoring_config",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_rating_weight", sa.Float, nullable=False, server_default="0.25"),
        sa.Column("po_rating_weight", sa.Float, nullable=False, server_default="0.35"),
        sa.Column("csat_weight", sa.Float, nullable=False, server_default="0.25"),
        sa.Column("effort_weight", sa.Float, nullable=False, server_default="0.15"),
        sa.Column("threshold_medium", sa.Float, nullable=False, server_default="3.5"),
        sa.Column("threshold_high", sa.Float, nullable=False, server_default="6.0"),
        sa.Column("threshold_critical", sa.Float, nullable=False, server_default="8.0"),
        sa.Column("po_emails", JSONB, nullable=False, server_default='["tunm1@ghn.vn"]'),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.execute("INSERT INTO scoring_config (id) VALUES (1)")

    # Team rater config (one row per team)
    op.create_table(
        "team_rater_config",
        sa.Column("team", sa.Text, primary_key=True),
        sa.Column("rater_email", sa.Text, nullable=False),
    )


def downgrade() -> None:
    op.drop_table("team_rater_config")
    op.drop_table("scoring_config")
    for col in ["user_rating", "po_rating", "tech_effort", "csat_score",
                "composite_score", "user_rating_by", "po_rating_by", "effort_set_by"]:
        op.drop_column("issues", col)
