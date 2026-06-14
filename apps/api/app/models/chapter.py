import uuid

from sqlalchemy import ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class ChapterStatus:
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"


class Chapter(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "chapters"

    book_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=ChapterStatus.DRAFT
    )

    book: Mapped["Book"] = relationship("Book", back_populates="chapters")
    scenes: Mapped[list["Scene"]] = relationship(
        "Scene",
        back_populates="chapter",
        cascade="all, delete-orphan",
        order_by="Scene.order_index",
    )
