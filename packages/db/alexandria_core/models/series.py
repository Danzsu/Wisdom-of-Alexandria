import uuid

from sqlalchemy import ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from alexandria_core.models.base import Base, Timestamps, UUIDPrimaryKey


class Series(UUIDPrimaryKey, Timestamps, Base):
    """A sub-universe under a Project that groups Books and scopes Codex.

    A Series sits UNDER a Project (``project_id``, CASCADE — deleting the project
    removes its series). Books and CodexEntries carry an OPTIONAL ``series_id``
    (ON DELETE SET NULL): deleting a series does NOT delete its books/entries —
    they fall back to project-only scope.
    """

    __tablename__ = "series"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    project: Mapped["Project"] = relationship("Project", back_populates="series")
