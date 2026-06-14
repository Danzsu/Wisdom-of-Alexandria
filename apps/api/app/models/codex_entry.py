import uuid

from sqlalchemy import Boolean, ForeignKey, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, Timestamps, UUIDPrimaryKey


class CodexEntry(UUIDPrimaryKey, Timestamps, Base):
    """Generic codex card for custom worldbuilding items."""

    __tablename__ = "codex_entries"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    entry_type: Mapped[str] = mapped_column(
        String(100), nullable=False, default="custom"
    )
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True, default=list)

    project: Mapped["Project"] = relationship(
        "Project", back_populates="codex_entries"
    )
