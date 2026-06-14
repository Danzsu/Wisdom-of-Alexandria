import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class AIComment(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "ai_comments"

    scene_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("scenes.id", ondelete="CASCADE"),
        nullable=True,
    )
    start_offset: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_offset: Mapped[int | None] = mapped_column(Integer, nullable=True)
    comment: Mapped[str] = mapped_column(Text, nullable=False)
    comment_type: Mapped[str] = mapped_column(
        String(100), nullable=False, default="suggestion"
    )
    resolved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    scene: Mapped["Scene | None"] = relationship("Scene", back_populates="ai_comments")
