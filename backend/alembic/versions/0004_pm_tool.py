"""add PM tool tables

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-08
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "products",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("telegram_group_id", sa.String(50), nullable=True),
        sa.Column("kb_gdoc_url", sa.Text, nullable=True),
        sa.Column("jira_project_key", sa.String(20), nullable=True),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "feedbacks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("product_id", sa.String(36), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("raw_content", sa.Text, nullable=False),
        sa.Column("media_urls", JSONB, nullable=True),
        sa.Column("submitted_by", sa.String(200), nullable=True),
        sa.Column("source", sa.String(20), nullable=False, server_default="manual"),
        sa.Column("status", sa.String(30), nullable=False, server_default="new"),
        sa.Column("telegram_message_id", sa.String(50), nullable=True),
        sa.Column("telegram_group_id", sa.String(50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "feedback_analyses",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("feedback_id", sa.String(36), sa.ForeignKey("feedbacks.id"), nullable=False),
        sa.Column("root_cause", sa.Text, nullable=True),
        sa.Column("impact_level", sa.String(20), nullable=True),
        sa.Column("affected_area", sa.String(30), nullable=True),
        sa.Column("kb_references", JSONB, nullable=True),
        sa.Column("ai_raw", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("feedback_id", name="uq_feedback_analyses_feedback_id"),
    )

    op.create_table(
        "solution_drafts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("feedback_id", sa.String(36), sa.ForeignKey("feedbacks.id"), nullable=False),
        sa.Column("product_id", sa.String(36), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("problem_statement", sa.Text, nullable=True),
        sa.Column("proposed_solution", sa.Text, nullable=True),
        sa.Column("success_metrics", sa.Text, nullable=True),
        sa.Column("effort_estimate", sa.String(5), nullable=True),
        sa.Column("open_questions", sa.Text, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("rejection_reason", sa.Text, nullable=True),
        sa.Column("gdoc_url", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "meetings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("product_id", sa.String(36), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("meeting_type", sa.String(20), nullable=False, server_default="daily"),
        sa.Column("participants", JSONB, nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="upcoming"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "meeting_notes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("meeting_id", sa.String(36), sa.ForeignKey("meetings.id"), nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "action_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("product_id", sa.String(36), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("assignee", sa.String(200), nullable=True),
        sa.Column("deadline", sa.Date, nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="todo"),
        sa.Column("source_meeting_id", sa.String(36), sa.ForeignKey("meetings.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("action_items")
    op.drop_table("meeting_notes")
    op.drop_table("meetings")
    op.drop_table("solution_drafts")
    op.drop_table("feedback_analyses")
    op.drop_table("feedbacks")
    op.drop_table("products")
