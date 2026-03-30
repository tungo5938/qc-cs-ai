from sqlalchemy import String, Text, ForeignKey, UniqueConstraint, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base
from models.base import TimestampMixin, gen_uuid
import enum


class VoteType(str, enum.Enum):
    up = "up"
    down = "down"


class Vote(Base, TimestampMixin):
    __tablename__ = "votes"
    __table_args__ = (UniqueConstraint("issue_id", "voter_email", name="uq_vote_per_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    issue_id: Mapped[str] = mapped_column(String(36), ForeignKey("issues.id", ondelete="CASCADE"), nullable=False)
    voter_email: Mapped[str] = mapped_column(Text, nullable=False)
    vote_type: Mapped[VoteType] = mapped_column(SAEnum(VoteType), nullable=False)

    issue: Mapped["Issue"] = relationship("Issue", back_populates="votes")
