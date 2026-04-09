from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base
from models.base import gen_uuid

if TYPE_CHECKING:
    from models.product import Product
    from models.meeting import Meeting


class ActionItem(Base):
    __tablename__ = "action_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    product_id: Mapped[str] = mapped_column(String(36), ForeignKey("products.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    assignee: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    deadline: Mapped[Optional[object]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="todo")
    # 'todo' | 'in_progress' | 'done'
    source_meeting_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("meetings.id"), nullable=True
    )
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    product: Mapped[Optional["Product"]] = relationship("Product", foreign_keys=[product_id])
    source_meeting: Mapped[Optional["Meeting"]] = relationship(
        "Meeting", back_populates="action_items", foreign_keys=[source_meeting_id]
    )
