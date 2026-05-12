from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Date, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base
from models.base import gen_uuid

if TYPE_CHECKING:
    from models.product import Product


class SprintConfig(Base):
    __tablename__ = "sprint_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    product_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=True, index=True
    )
    anchor_date: Mapped[object] = mapped_column(Date, nullable=False)
    sprint_length_weeks: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    product: Mapped[Optional["Product"]] = relationship("Product", foreign_keys=[product_id])
