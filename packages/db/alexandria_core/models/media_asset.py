import uuid

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column

from alexandria_core.models.base import Base, Timestamps, UUIDPrimaryKey


class MediaAsset(UUIDPrimaryKey, Timestamps, Base):
    """Metadata for a generated image (AI image generation, Phase 1).

    One row per generated image; the binary itself lives on the filesystem
    (``file_path`` / ``thumb_path`` under the configured ``media_dir``), not in
    the database. ``entity_type`` is "character" | "location" | "cover";
    ``entity_id`` points at the subject (NULL is allowed for project-level
    covers later). ``status`` tracks the generation lifecycle
    (generating | ready | failed). ``job_id`` is a plain (un-FK'd) column that
    correlates the asset with the generation job that produced it — mirroring
    how ``generation_jobs.chapter_id`` is a plain ``Uuid``.
    """

    __tablename__ = "media_assets"
    __table_args__ = (
        Index("ix_media_assets_entity", "entity_type", "entity_id"),
    )

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # character | location | cover
    entity_type: Mapped[str] = mapped_column(String(32), nullable=False)
    # Subject of the image; NULL for project-level covers (later).
    entity_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True, index=True
    )
    # generating | ready | failed
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="generating"
    )
    file_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    thumb_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    mime: Mapped[str] = mapped_column(
        String(50), nullable=False, default="image/png"
    )
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    style: Mapped[str | None] = mapped_column(String(100), nullable=True)
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_canonical: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    # Correlates with the generation job that produced this asset. Plain column
    # (no FK) — mirrors generation_jobs.chapter_id.
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True
    )
