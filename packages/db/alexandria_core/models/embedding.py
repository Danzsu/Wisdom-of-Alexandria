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
    unique per-entity UUID, so ``book_id`` is intentionally NOT part of the
    constraint — it is denormalized onto the row only for fast book-scoped
    retrieval + cascade delete, not for identity.

    The ``embedding`` column is a dialect-aware ``Vector``: a real
    ``vector(1536)`` column on PostgreSQL (cosine-distance ANN search) and a
    ``JSON`` array on the SQLite test database, so the model loads under
    ``Base.metadata.create_all`` on both backends.
    """

    __tablename__ = "embeddings"
    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", name="uq_embeddings_entity"),
    )

    book_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("books.id", ondelete="CASCADE"),
        nullable=False,
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
    dim: Mapped[int] = mapped_column(Integer, nullable=False, default=EMBEDDING_DIM)
