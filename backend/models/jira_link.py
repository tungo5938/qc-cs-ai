from sqlalchemy import String, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base
from models.base import TimestampMixin, gen_uuid
from datetime import datetime
from sqlalchemy import DateTime


class JiraLink(Base, TimestampMixin):
    __tablename__ = "jira_links"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    issue_id: Mapped[str] = mapped_column(String(36), ForeignKey("issues.id", ondelete="CASCADE"), nullable=False)
    jira_url: Mapped[str] = mapped_column(Text, nullable=False)
    jira_ticket_key: Mapped[str] = mapped_column(Text, nullable=False)
    jira_status: Mapped[str | None] = mapped_column(Text, nullable=True)
    jira_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    jira_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    issue: Mapped["Issue"] = relationship("Issue", back_populates="jira_link")
