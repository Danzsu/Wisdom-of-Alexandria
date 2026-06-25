import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from alexandria_core.models.base import Base, Timestamps, UUIDPrimaryKey


class Location(UUIDPrimaryKey, Timestamps, Base):
    __tablename__ = "locations"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    geography: Mapped[str | None] = mapped_column(Text, nullable=True)
    atmosphere: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_visible: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default=text("true")
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    project: Mapped["Project"] = relationship("Project", back_populates="locations")
