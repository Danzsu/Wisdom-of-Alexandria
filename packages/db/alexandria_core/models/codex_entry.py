import uuid

from sqlalchemy import JSON, Boolean, ForeignKey, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from alexandria_core.models.base import Base, Timestamps, UUIDPrimaryKey


class CodexEntry(UUIDPrimaryKey, Timestamps, Base):
    """Generic codex card for custom worldbuilding items."""

    __tablename__ = "codex_entries"

    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    # Optional series scope. NULL = project-global (visible everywhere in the
    # project); set = scoped to that series only. SET NULL on series delete so a
    # scoped entry falls back to project-global rather than being deleted.
    series_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("series.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    entry_type: Mapped[str] = mapped_column(
        String(100), nullable=False, default="custom"
    )
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Recognition names (Álnevek / Becenevek) — mirrors Character.aliases so the
    # manuscript name-scan can resolve a mention by an alias, not just the title.
    # No Python-side ``default=list`` (mutable-default footgun). The DB column
    # carries ``server_default='[]'`` (migration a1c4d7e9f2b3) for rows whose
    # INSERT omits the column. The normal write path is the create schema, which
    # defaults aliases to ``[]`` (default_factory), so the API never persists
    # NULL. Direct model construction without aliases may persist NULL, which the
    # CodexEntryRead schema coerces back to ``[]`` (it never raises on a NULL).
    aliases: Mapped[list | None] = mapped_column(JSON, nullable=True)
    # The single story role (Hős / Antagonista / …) — mirrors Character.role.
    role: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ai_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # No Python-side ``default=list`` here either (same mutable-default footgun as
    # aliases): the create schema defaults tags to ``[]`` and CodexEntryRead coerces
    # a NULL back to ``[]``, so a direct construction never leaks a shared list.
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)

    project: Mapped["Project"] = relationship(
        "Project", back_populates="codex_entries"
    )
