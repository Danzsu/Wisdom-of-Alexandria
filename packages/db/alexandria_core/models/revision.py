import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from alexandria_core.models.base import Base, Timestamps, UUIDPrimaryKey


class Revision(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "revisions"

    scene_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("scenes.id", ondelete="SET NULL"),
        nullable=True,
    )
    job_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("generation_jobs.id", ondelete="SET NULL"),
        nullable=True,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    revision_type: Mapped[str] = mapped_column(String(100), nullable=False)
    model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(100), nullable=True)

    scene: Mapped["Scene | None"] = relationship("Scene", back_populates="revisions")
    job: Mapped["GenerationJob | None"] = relationship(
        "GenerationJob", back_populates="revisions"
    )
