from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, DateTime, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base
from models.base import gen_uuid

if TYPE_CHECKING:
    from models.feedback import Feedback


class FeedbackAnalysis(Base):
    __tablename__ = "feedback_analyses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    feedback_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("feedbacks.id"), nullable=False, unique=True
    )
    root_cause: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    impact_level: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # 'low' | 'medium' | 'high'
    affected_area: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # 'ui' | 'logic' | 'performance' | 'integration' | 'other'
    kb_references: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)  # list of str
    ai_raw: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    solution_hint: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    acceptance_criteria: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    feedback: Mapped[Optional["Feedback"]] = relationship("Feedback", back_populates="analysis")
