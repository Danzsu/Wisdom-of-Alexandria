import uuid

from sqlalchemy import ForeignKey, Integer, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from alexandria_core.models.base import Base, Timestamps, UUIDPrimaryKey


class PlotlineScene(UUIDPrimaryKey, Timestamps, Base):
    """Association row linking a Scene to a Plotline (``related_scenes[]``).

    Both FKs CASCADE: deleting the plotline OR the scene removes the link (never
    the other side's row beyond the link itself). A scene may be attached to a
    given plotline at most once — enforced by the ``UniqueConstraint`` on
    (``plotline_id``, ``scene_id``).
    """

    __tablename__ = "plotline_scenes"
    __table_args__ = (
        UniqueConstraint(
            "plotline_id", "scene_id", name="uq_plotline_scenes_plotline_scene"
        ),
    )

    plotline_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("plotlines.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    scene_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("scenes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    plotline: Mapped["Plotline"] = relationship(
        "Plotline", back_populates="scene_links"
    )
    scene: Mapped["Scene"] = relationship("Scene")
