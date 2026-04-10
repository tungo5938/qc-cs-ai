from __future__ import annotations
from typing import Optional
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base
from models.base import gen_uuid
from datetime import datetime
from sqlalchemy import DateTime, func


class Product(Base):
    __tablename__ = "products"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    telegram_group_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    kb_gdoc_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    jira_project_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    product_goal: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    kb_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    google_sheet_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
