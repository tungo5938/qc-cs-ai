from __future__ import annotations
from typing import Optional
import sqlalchemy as sa
from sqlalchemy import String, Text, Boolean, BigInteger, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base
from models.base import TimestampMixin, gen_uuid
import enum


class IssueType(str, enum.Enum):
    bug = "bug"
    feature_request = "feature_request"
    unclear = "unclear"


class TeamType(str, enum.Enum):
    cs_b2c = "cs_b2c"
    cs_c2c = "cs_c2c"
    telesales = "telesales"
    unknown = "unknown"


class IssueStatus(str, enum.Enum):
    pending_review = "pending_review"
    approved = "approved"
    rejected = "rejected"
    in_progress = "in_progress"
    done = "done"


class IssuePriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class IssueSource(str, enum.Enum):
    telegram = "telegram"
    portal = "portal"


class Issue(Base, TimestampMixin):
    __tablename__ = "issues"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    type: Mapped[IssueType] = mapped_column(SAEnum(IssueType), default=IssueType.unclear)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[IssueStatus] = mapped_column(SAEnum(IssueStatus), default=IssueStatus.pending_review)
    priority: Mapped[IssuePriority] = mapped_column(SAEnum(IssuePriority), default=IssuePriority.medium)
    source: Mapped[IssueSource] = mapped_column(SAEnum(IssueSource), nullable=False)
    submitted_by_email: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    telegram_group_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    telegram_message_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    telegram_poster_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    media_urls: Mapped[list] = mapped_column(JSONB, default=list)
    ai_classification_raw: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    root_cause: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    team: Mapped[TeamType] = mapped_column(SAEnum(TeamType), default=TeamType.unknown)
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_by_email: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Scoring
    user_rating: Mapped[Optional[float]] = mapped_column(sa.Float, nullable=True)
    user_rating_by: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    po_rating: Mapped[Optional[float]] = mapped_column(sa.Float, nullable=True)
    po_rating_by: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tech_effort: Mapped[Optional[int]] = mapped_column(sa.Integer, nullable=True)
    effort_set_by: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    csat_score: Mapped[Optional[float]] = mapped_column(sa.Float, nullable=True)
    composite_score: Mapped[Optional[float]] = mapped_column(sa.Float, nullable=True)

    jira_link: Mapped[Optional["JiraLink"]] = relationship("JiraLink", back_populates="issue", uselist=False)
    telegram_thread: Mapped[Optional["TelegramThread"]] = relationship("TelegramThread", back_populates="issue", uselist=False)
    votes: Mapped[list["Vote"]] = relationship("Vote", back_populates="issue")
    comments: Mapped[list["Comment"]] = relationship("Comment", back_populates="issue")
