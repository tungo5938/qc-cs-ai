from __future__ import annotations
from typing import Optional
from sqlalchemy import String, Text, Boolean, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base
from models.base import TimestampMixin, gen_uuid
import enum


class KBSourceType(str, enum.Enum):
    google_doc = "google_doc"
    jira_ticket = "jira_ticket"
    manual = "manual"


class KBEntry(Base, TimestampMixin):
    __tablename__ = "kb_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    source_type: Mapped[KBSourceType] = mapped_column(SAEnum(KBSourceType), nullable=False)
    source_ref: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    imported_by_email: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
