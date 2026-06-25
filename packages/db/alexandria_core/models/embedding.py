import uuid

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from alexandria_core.core.config import EMBEDDING_DIM
from alexandria_core.db.vector import Vector
from alexandria_core.models.base import Base, Timestamps, UUIDPrimaryKey


class Embedding(UUIDPrimaryKey, Timestamps, Base):
    """A stored embedding vector for one RAG-indexable entity.

    Each row embeds a single source entity (a codex card, character, location,
    worldbuilding entry, scene, chapter, or style guide). ``content_hash`` lets
    the indexer skip re-embedding unchanged content, and the
    ``(entity_type, entity_id)`` uniqueness keeps exactly one current vector per
    entity (re-embedding updates the row in place). ``entity_id`` is a globally
    unique per-entity UUID, so neither ``project_id`` nor ``book_id`` is part of
    the constraint — they are denormalized onto the row only for scoping +
    cascade delete, not for identity.

    Scoping (B2b): RAG operates at the **PROJECT** level. A generation in book X
    of project P needs P's codex (project-scoped) AND the project's manuscript
    (scene/chapter, book-scoped). So ``project_id`` is the primary, NON-null
    retrieval scope for every row; ``book_id`` is NULLABLE and set only for
    manuscript entities (scene/chapter) as provenance + a future per-book filter.
    Project-scoped entities (codex/character/location/worldbuilding/styleguide)
    leave ``book_id`` NULL.

    Scoping (B3b): RAG is additionally **SERIES**-aware. ``series_id`` is NULLABLE
    — NULL = project-global (every book sees it), set = series-scoped (only books
    in that series retrieve it). It mirrors the source's series scope: codex from
    ``CodexEntry.series_id``; scene/chapter from the owning book's ``series_id``;
    project-global entities (character/location/worldbuilding/styleguide) stay
    NULL. Retrieval filters ``series_id IS NULL OR series_id == <active series>``,
    so other series' codex + other series' books' manuscript never leak in. The
    project-wide index is unchanged — only the QUERY is series-scoped.

    The ``embedding`` column is a dialect-aware ``Vector``: a real
    ``vector(1536)`` column on PostgreSQL (cosine-distance ANN search) and a
    ``JSON`` array on the SQLite test database, so the model loads under
    ``Base.metadata.create_all`` on both backends.
    """

    __tablename__ = "embeddings"
    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", name="uq_embeddings_entity"),
    )

    # Primary retrieval scope — every embedding belongs to exactly one project.
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Provenance + future per-book filter; set only for manuscript entities
    # (scene/chapter). NULL for project-scoped entities (codex, character, …).
    book_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # Series scope (B3b): NULL = project-global (visible to every book), set =
    # series-scoped (only books in that series may retrieve it). Mirrors the
    # source entity's series scope — codex from ``CodexEntry.series_id``, and
    # scene/chapter from the owning book's ``series_id``; project-global entities
    # (character/location/worldbuilding/styleguide) leave it NULL. SET NULL on a
    # series delete so the embedding falls back to project-global scope rather
    # than vanishing. Retrieval filters on ``series_id IS NULL OR == active``.
    series_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("series.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # codex | character | location | worldbuilding | scene | chapter | styleguide
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    # Hash of the embedded source text — used to skip re-embedding unchanged content.
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(EMBEDDING_DIM), nullable=True
    )
    # The embedding model that produced the vector (e.g. text-embedding-3-small).
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    # The vector width actually stored (mirrors EMBEDDING_DIM at write time).
    dim: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=EMBEDDING_DIM,
        server_default=str(EMBEDDING_DIM),
    )
