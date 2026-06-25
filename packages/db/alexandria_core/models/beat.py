import uuid

from sqlalchemy import ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from alexandria_core.models.base import Base, Timestamps, UUIDPrimaryKey


class Beat(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "beats"

    scene_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("scenes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    beat_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    scene: Mapped["Scene"] = relationship("Scene", back_populates="beats")
