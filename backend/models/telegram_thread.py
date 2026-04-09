from __future__ import annotations
from typing import Optional
from sqlalchemy import String, BigInteger, SmallInteger, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base
from models.base import TimestampMixin, gen_uuid
import enum


class QAState(str, enum.Enum):
    awaiting_classification = "awaiting_classification"
    awaiting_reply_1 = "awaiting_reply_1"
    awaiting_reply_2 = "awaiting_reply_2"
    complete = "complete"


class TelegramThread(Base, TimestampMixin):
    __tablename__ = "telegram_threads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    issue_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("issues.id", ondelete="SET NULL"), nullable=True)
    group_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    root_message_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    qa_round: Mapped[int] = mapped_column(SmallInteger, default=0)
    qa_state: Mapped[QAState] = mapped_column(SAEnum(QAState), default=QAState.awaiting_classification)
    last_bot_message_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    poster_tg_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    collected_context: Mapped[Optional[str]] = mapped_column(String(4000), nullable=True)

    issue: Mapped[Optional["Issue"]] = relationship("Issue", back_populates="telegram_thread")
