"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")

    op.create_table(
        "issues",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("type", sa.Enum("bug", "feature_request", "unclear", name="issuetype"), nullable=False, server_default="unclear"),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("status", sa.Enum("pending_review", "approved", "rejected", "in_progress", "done", name="issuestatus"), nullable=False, server_default="pending_review"),
        sa.Column("priority", sa.Enum("low", "medium", "high", "critical", name="issuepriority"), nullable=False, server_default="medium"),
        sa.Column("source", sa.Enum("telegram", "portal", name="issuesource"), nullable=False),
        sa.Column("submitted_by_email", sa.Text, nullable=True),
        sa.Column("telegram_group_id", sa.BigInteger, nullable=True),
        sa.Column("telegram_message_id", sa.BigInteger, nullable=True),
        sa.Column("telegram_poster_id", sa.BigInteger, nullable=True),
        sa.Column("media_urls", JSONB, nullable=False, server_default="[]"),
        sa.Column("ai_classification_raw", JSONB, nullable=True),
        sa.Column("root_cause", sa.Text, nullable=True),
        sa.Column("is_public", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("approved_by_email", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_table(
        "jira_links",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("issue_id", sa.String(36), sa.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("jira_url", sa.Text, nullable=False),
        sa.Column("jira_ticket_key", sa.Text, nullable=False),
        sa.Column("jira_status", sa.Text, nullable=True),
        sa.Column("jira_summary", sa.Text, nullable=True),
        sa.Column("jira_description", sa.Text, nullable=True),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_table(
        "telegram_threads",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("issue_id", sa.String(36), sa.ForeignKey("issues.id", ondelete="SET NULL"), nullable=True),
        sa.Column("group_id", sa.BigInteger, nullable=False),
        sa.Column("root_message_id", sa.BigInteger, nullable=False),
        sa.Column("qa_round", sa.SmallInteger, nullable=False, server_default="0"),
        sa.Column("qa_state", sa.Enum("awaiting_classification", "awaiting_reply_1", "awaiting_reply_2", "complete", name="qastate"), nullable=False, server_default="awaiting_classification"),
        sa.Column("last_bot_message_id", sa.BigInteger, nullable=True),
        sa.Column("poster_tg_user_id", sa.BigInteger, nullable=False),
        sa.Column("collected_context", sa.String(4000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_table(
        "votes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("issue_id", sa.String(36), sa.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("voter_email", sa.Text, nullable=False),
        sa.Column("vote_type", sa.Enum("up", "down", name="votetype"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint("issue_id", "voter_email", name="uq_vote_per_user"),
    )

    op.create_table(
        "kb_entries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("source_type", sa.Enum("google_doc", "jira_ticket", "manual", name="kbsourcetype"), nullable=False),
        sa.Column("source_ref", sa.Text, nullable=True),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("imported_by_email", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.execute("CREATE INDEX idx_kb_entries_fts ON kb_entries USING GIN (to_tsvector('english', content))")

    op.create_table(
        "comments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("issue_id", sa.String(36), sa.ForeignKey("issues.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_email", sa.Text, nullable=False),
        sa.Column("body", sa.Text, nullable=False),
        sa.Column("is_internal", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("comments")
    op.drop_table("kb_entries")
    op.drop_table("votes")
    op.drop_table("telegram_threads")
    op.drop_table("jira_links")
    op.drop_table("issues")
    op.execute("DROP TYPE IF EXISTS issuetype")
    op.execute("DROP TYPE IF EXISTS issuestatus")
    op.execute("DROP TYPE IF EXISTS issuepriority")
    op.execute("DROP TYPE IF EXISTS issuesource")
    op.execute("DROP TYPE IF EXISTS qastate")
    op.execute("DROP TYPE IF EXISTS votetype")
    op.execute("DROP TYPE IF EXISTS kbsourcetype")
