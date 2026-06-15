"""add_embeddings_table

Revision ID: b2a2d3e4f5a6
Revises: b2a1c0d1e2f3
Create Date: 2026-06-15 18:10:00.000000

Hand-written (Alembic autogenerate needs a live PostgreSQL connection, which the
local dev environment lacks). Creates the ``embeddings`` table that backs RAG
retrieval over Codex + manuscript content.

Dialect-aware + portable (mirrors the guard style requested for B2a):

  - On PostgreSQL: ``CREATE EXTENSION IF NOT EXISTS vector`` first, then a real
    ``vector(1536)`` column (via ``pgvector.sqlalchemy.Vector``) and an
    ``ivfflat`` ANN index using ``vector_cosine_ops`` for cosine-distance search.
  - On SQLite (the non-postgres test tier built with ``create_all`` — this
    migration is not actually run there, but is kept importable/portable): the
    embedding column degrades to ``JSON`` and the PG-only DDL is skipped.

All PostgreSQL-only statements are guarded by
``op.get_bind().dialect.name == "postgresql"`` so the migration never emits
``vector`` DDL on a non-PG backend.

Embedding width is fixed at 1536 to match OpenAI ``text-embedding-3-small`` and
``alexandria_core.core.config.EMBEDDING_DIM``.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2a2d3e4f5a6"
down_revision: str | Sequence[str] | None = "b2a1c0d1e2f3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

EMBEDDING_DIM = 1536


def _embedding_column() -> sa.Column:
    """The embedding vector column, typed per dialect.

    PostgreSQL gets a real ``vector(N)`` column; any other backend (SQLite) gets
    JSON so the table can still be created portably.
    """
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        from pgvector.sqlalchemy import Vector

        return sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=True)
    return sa.Column("embedding", sa.JSON(), nullable=True)


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # pgvector's column type requires the extension to exist first (PG only).
    if is_postgres:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "embeddings",
        sa.Column("id", sa.Uuid(as_uuid=True), primary_key=True),
        sa.Column(
            "book_id",
            sa.Uuid(as_uuid=True),
            sa.ForeignKey("books.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.Uuid(as_uuid=True), nullable=False),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        _embedding_column(),
        sa.Column("model_name", sa.String(length=255), nullable=False),
        sa.Column("dim", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("entity_type", "entity_id", name="uq_embeddings_entity"),
    )
    op.create_index("ix_embeddings_book_id", "embeddings", ["book_id"])

    # Cosine-distance ANN index — PostgreSQL/pgvector only. ivfflat with
    # vector_cosine_ops matches the ``<=>`` ordering used by B2b retrieval.
    if is_postgres:
        op.execute(
            "CREATE INDEX ix_embeddings_embedding_cosine ON embeddings "
            "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
        )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP INDEX IF EXISTS ix_embeddings_embedding_cosine")
    op.drop_index("ix_embeddings_book_id", table_name="embeddings")
    op.drop_table("embeddings")
    # The ``vector`` extension is intentionally NOT dropped on downgrade: other
    # objects may depend on it, and dropping a shared extension is destructive.
