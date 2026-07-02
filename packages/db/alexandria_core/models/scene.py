import uuid

from sqlalchemy import ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from alexandria_core.models.base import Base, Timestamps, UUIDPrimaryKey


class SceneStatus:
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"
    ARCHIVED = "archived"


class Scene(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "scenes"

    chapter_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("chapters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=SceneStatus.DRAFT
    )
    word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    pov_character_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("characters.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    location_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("locations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    chapter: Mapped["Chapter"] = relationship("Chapter", back_populates="scenes")
    pov_character: Mapped["Character | None"] = relationship(
        "Character", foreign_keys=[pov_character_id]
    )
    location: Mapped["Location | None"] = relationship(
        "Location", foreign_keys=[location_id]
    )
    beats: Mapped[list["Beat"]] = relationship(
        "Beat",
        back_populates="scene",
        cascade="all, delete-orphan",
        order_by="Beat.order_index",
    )
    revisions: Mapped[list["Revision"]] = relationship(
        "Revision", back_populates="scene", cascade="all, delete-orphan"
    )
    ai_comments: Mapped[list["AIComment"]] = relationship(
        "AIComment", back_populates="scene", cascade="all, delete-orphan"
    )
