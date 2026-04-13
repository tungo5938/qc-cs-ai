from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import JSONB
from core.database import Base
from models.base import gen_uuid

if TYPE_CHECKING:
    from models.feedback import Feedback
    from models.product import Product


class SolutionDraft(Base):
    __tablename__ = "solution_drafts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    feedback_id: Mapped[str] = mapped_column(String(36), ForeignKey("feedbacks.id"), nullable=False)
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), nullable=False)
    problem_statement: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    proposed_solution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    success_metrics: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    effort_estimate: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)  # 'S' | 'M' | 'L' | 'XL'
    open_questions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")  # 'draft' | 'approved' | 'rejected'
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    gdoc_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Phase 2
    prd_content: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    tldraw_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    jira_epic_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    solution_chat_history: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    feedback: Mapped[Optional["Feedback"]] = relationship(
        "Feedback", back_populates="solution_drafts"
    )
    product: Mapped[Optional["Product"]] = relationship(
        "Product", foreign_keys=[product_id]
    )
