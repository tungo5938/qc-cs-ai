from __future__ import annotations
from sqlalchemy import Integer, Float, Text, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import func
from core.database import Base


class ScoringConfig(Base):
    __tablename__ = "scoring_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_rating_weight: Mapped[float] = mapped_column(Float, default=0.25)
    po_rating_weight: Mapped[float] = mapped_column(Float, default=0.35)
    csat_weight: Mapped[float] = mapped_column(Float, default=0.25)
    effort_weight: Mapped[float] = mapped_column(Float, default=0.15)
    threshold_medium: Mapped[float] = mapped_column(Float, default=3.5)
    threshold_high: Mapped[float] = mapped_column(Float, default=6.0)
    threshold_critical: Mapped[float] = mapped_column(Float, default=8.0)
    po_emails: Mapped[list] = mapped_column(JSONB, default=lambda: ["tunm1@ghn.vn"])
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TeamRaterConfig(Base):
    __tablename__ = "team_rater_config"

    team: Mapped[str] = mapped_column(Text, primary_key=True)
    rater_email: Mapped[str] = mapped_column(Text, nullable=False)
