from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base
from models.base import gen_uuid

if TYPE_CHECKING:
    from models.product import Product
    from models.meeting_note import MeetingNote
    from models.action_item import ActionItem


class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    meeting_type: Mapped[str] = mapped_column(String(50), nullable=False, default="daily")
    # 'daily' | 'grooming' | 'planning' | 'review'
    participants: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True)
    scheduled_at: Mapped[Optional[object]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="upcoming")
    # 'upcoming' | 'in_progress' | 'done'
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    product: Mapped[Optional["Product"]] = relationship("Product", foreign_keys=[product_id])
    notes: Mapped[list["MeetingNote"]] = relationship(
        "MeetingNote", back_populates="meeting", uselist=True
    )
    action_items: Mapped[list["ActionItem"]] = relationship(
        "ActionItem", back_populates="source_meeting", foreign_keys="ActionItem.source_meeting_id"
    )
