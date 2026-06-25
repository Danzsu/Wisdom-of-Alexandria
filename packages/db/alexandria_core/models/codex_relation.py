import uuid

from sqlalchemy import ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from alexandria_core.models.base import Base, Timestamps, UUIDPrimaryKey


class CodexRelation(UUIDPrimaryKey, Timestamps, Base):
    """Polymorphic relation between two codex entities. CRUD only, no UI in MVP."""

    __tablename__ = "codex_relations"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    from_entity_type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # "character", "location", etc.
    from_entity_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    to_entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    to_entity_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    relation_type: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
