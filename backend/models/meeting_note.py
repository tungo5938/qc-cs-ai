from __future__ import annotations
from typing import TYPE_CHECKING
from sqlalchemy import String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base
from models.base import gen_uuid

if TYPE_CHECKING:
    from models.meeting import Meeting


class MeetingNote(Base):
    __tablename__ = "meeting_notes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationship
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="notes")
