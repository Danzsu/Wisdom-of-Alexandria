"""add_embedding_series_scope

Revision ID: c3b2d4e5f6a7
Revises: c3a1b2c3d4e5
Create Date: 2026-06-16 16:00:00.000000

Hand-written (Alembic autogenerate needs a live PostgreSQL connection, which the
local dev environment lacks). Feature #3b — series-aware RAG retrieval:

  - Adds a NULLABLE ``series_id`` (FK series.id, ON DELETE SET NULL, indexed) to
    ``embeddings`` — NULL = project-global (every book retrieves it), set =
    series-scoped (only books in that series retrieve it). Deleting a series must
    NOT delete the embedding; it falls back to project-global scope (SET NULL).

Portability (dialect split — identical approach to ``c3a1b2c3d4e5``'s
``books.series_id`` / ``codex_entries.series_id`` columns):
  - PostgreSQL: add the nullable column via plain ``ALTER TABLE``, create the
    index, then the named ``ON DELETE SET NULL`` FK.
  - SQLite: add the column bare (``ALTER TABLE ... ADD COLUMN``, natively
    supported) plus the index, and SKIP the FK DDL. Adding an FK on SQLite needs
    a full table rebuild (batch mode), which is unreliable inside the single
    async (aiosqlite) migration transaction once another table has been rebuilt
    in the same run. The model still declares the ``SET NULL`` FK, so it is
    authoritative on PostgreSQL and in the SQLite test tier (which builds the
    schema from the model via ``create_all``, not from this migration).

``embeddings.series_id`` is owned EXACTLY by this revision. The ``embeddings``
table itself is created in ``b2a2d3e4f5a6`` and is excluded wholesale from the
initial-schema migration (``91516a452442`` ``_TABLES_ADDED_LATER``), so there is
no double-create risk for any of its columns.

Verified: ``alembic upgrade head`` + ``downgrade base`` both run clean on SQLite.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3b2d4e5f6a7"
down_revision: str | Sequence[str] | None = "c3a1b2c3d4e5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Dialect split (see module docstring): on PostgreSQL add the column + named
    # SET NULL FK via plain ``ALTER TABLE``; on SQLite add a bare nullable column
    # + index and skip the FK DDL (a SQLite FK add needs an unreliable batch
    # rebuild inside the async migration transaction). The model's
    # ``ondelete="SET NULL"`` FK stays authoritative on PostgreSQL and in the
    # SQLite test tier (built from the model via ``create_all``).
    is_postgres = op.get_bind().dialect.name == "postgresql"

    op.add_column(
        "embeddings",
        sa.Column("series_id", sa.Uuid(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_embeddings_series_id", "embeddings", ["series_id"], unique=False
    )

    if is_postgres:
        op.create_foreign_key(
            "fk_embeddings_series_id_series",
            "embeddings",
            "series",
            ["series_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    """Downgrade schema."""
    # Mirror the dialect split: drop the named FK only on PostgreSQL (SQLite
    # never created it — the column was added bare). The index + column drop
    # natively on both backends (modern SQLite supports DROP COLUMN), avoiding
    # the unreliable async-aiosqlite batch table rebuild.
    is_postgres = op.get_bind().dialect.name == "postgresql"

    if is_postgres:
        op.drop_constraint(
            "fk_embeddings_series_id_series", "embeddings", type_="foreignkey"
        )

    op.drop_index("ix_embeddings_series_id", table_name="embeddings")
    op.drop_column("embeddings", "series_id")
