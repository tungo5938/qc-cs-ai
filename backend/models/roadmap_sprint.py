from __future__ import annotations
from datetime import date
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base
from models.base import gen_uuid

if TYPE_CHECKING:
    from models.roadmap_phase import RoadmapPhase


class RoadmapSprint(Base):
    __tablename__ = "roadmap_sprints"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    phase_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("roadmap_phases.id", ondelete="CASCADE"), nullable=False
    )
    sprint_config_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("sprint_configs.id", ondelete="SET NULL"), nullable=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    sprint_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    phase: Mapped["RoadmapPhase"] = relationship("RoadmapPhase", back_populates="sprints")
