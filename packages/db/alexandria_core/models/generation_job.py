import uuid

from sqlalchemy import JSON, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from alexandria_core.models.base import Base, Timestamps, UUIDPrimaryKey


class JobStatus:
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


class JobType:
    """Known ``GenerationJob.job_type`` values. Free ``str`` on the wire, but
    these constants keep producer + consumer aligned (e.g. the async RAG index
    job uses ``INDEX``)."""

    INDEX = "index"
    IMAGE = "image"


class GenerationJob(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "generation_jobs"

    # Project scope. Set for project-level jobs (e.g. the async RAG index
    # rebuild) so they can be located + polled per project. NULL for the
    # scene/chapter-scoped generation jobs. CASCADE so a deleted project takes
    # its jobs with it.
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    scene_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("scenes.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    chapter_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), nullable=True
    )
    job_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default=JobStatus.PENDING
    )
    model_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    prompt_version: Mapped[str | None] = mapped_column(String(100), nullable=True)
    input_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    output_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    scene: Mapped["Scene | None"] = relationship("Scene")
    revisions: Mapped[list["Revision"]] = relationship(
        "Revision", back_populates="job", cascade="all, delete-orphan"
    )
