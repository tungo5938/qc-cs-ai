from __future__ import annotations
from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base
from models.base import gen_uuid
from datetime import datetime


class AllowedEmail(Base):
    __tablename__ = "allowed_emails"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    email: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    added_by: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
