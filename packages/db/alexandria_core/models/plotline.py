import uuid

from sqlalchemy import ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from alexandria_core.models.base import Base, Timestamps, UUIDPrimaryKey


class Plotline(UUIDPrimaryKey, Timestamps, Base):
    """A subplot / narrative thread (cselekményszál) within a Project.

    A Plotline sits UNDER a Project (``project_id``, CASCADE — deleting the
    project removes its plotlines). It MAY optionally be scoped to a single
    ``book_id`` (ON DELETE SET NULL): a plotline can span the whole project
    (``book_id`` NULL) or one book. Deleting that book does NOT delete the
    plotline — it falls back to project-wide scope.

    Scenes are attached via the ``PlotlineScene`` association (the
    ``related_scenes[]`` link), CASCADE-deleted with the plotline.
    """

    __tablename__ = "plotlines"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Optional book scope. SET NULL on book delete: removing a book must NOT
    # delete its plotlines — they fall back to project-wide scope.
    book_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("books.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Free-form string; the allowed set is validated in the schema layer (kept as
    # a plain str column per the project convention for status-like enums).
    plotline_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    project: Mapped["Project"] = relationship("Project")
    scene_links: Mapped[list["PlotlineScene"]] = relationship(
        "PlotlineScene",
        back_populates="plotline",
        cascade="all, delete-orphan",
        order_by="PlotlineScene.order_index",
    )
