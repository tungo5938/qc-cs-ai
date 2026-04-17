from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Text, ForeignKey, DateTime, Integer, Float, func
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base
from models.base import gen_uuid

if TYPE_CHECKING:
    from models.product import Product
    from models.feedback_analysis import FeedbackAnalysis


class Feedback(Base):
    __tablename__ = "feedbacks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), nullable=False)
    title: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    raw_content: Mapped[str] = mapped_column(Text, nullable=False)
    media_urls: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    submitted_by: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(Text, nullable=False, default="manual")  # 'telegram' | 'manual'
    status: Mapped[str] = mapped_column(Text, nullable=False, default="new")  # 'new' | 'analyzing' | 'analyzed' | 'solution_drafted'
    telegram_message_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    telegram_group_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    gsheet_row_index: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    feedback_type: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # 'bug' | 'feature' | 'unclear'
    user_priority: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    user_priority_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tech_rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tech_rating_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tu_danh_gia: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tu_danh_gia_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    priority_score: Mapped[Optional[float]] = mapped_column(sa.Float(), nullable=True)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    product: Mapped[Optional["Product"]] = relationship("Product", foreign_keys=[product_id])
    analysis: Mapped[Optional["FeedbackAnalysis"]] = relationship(
        "FeedbackAnalysis", back_populates="feedback", uselist=False
    )
    solution_drafts: Mapped[list] = relationship(
        "SolutionDraft", back_populates="feedback", uselist=True
    )
