from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base
from models.base import gen_uuid

if TYPE_CHECKING:
    from models.roadmap_sprint import RoadmapSprint
    from models.product import Product


class RoadmapPhase(Base):
    __tablename__ = "roadmap_phases"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    product_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    sprints: Mapped[list["RoadmapSprint"]] = relationship(
        "RoadmapSprint", back_populates="phase", cascade="all, delete-orphan"
    )
    product: Mapped[Optional["Product"]] = relationship("Product", foreign_keys=[product_id])
