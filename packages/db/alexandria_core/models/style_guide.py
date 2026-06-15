import uuid

from sqlalchemy import JSON, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from alexandria_core.models.base import Base, Timestamps, UUIDPrimaryKey


class StyleGuide(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "style_guides"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    tone: Mapped[str | None] = mapped_column(Text, nullable=True)
    pov: Mapped[str | None] = mapped_column(String(100), nullable=True)
    tense: Mapped[str | None] = mapped_column(String(50), nullable=True)
    rules: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    examples: Mapped[dict | None] = mapped_column(JSON, nullable=True, default=dict)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="style_guide")
