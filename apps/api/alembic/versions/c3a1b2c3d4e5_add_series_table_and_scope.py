"""add_series_table_and_scope

Revision ID: c3a1b2c3d4e5
Revises: b2b1e2f3a4b5
Create Date: 2026-06-16 14:00:00.000000

Hand-written (Alembic autogenerate needs a live PostgreSQL connection, which the
local dev environment lacks). Feature #3a — Series domain (data foundation for
series-scoped Codex):

  - Creates the ``series`` table (a sub-universe under a Project; CASCADE on
    project delete via ``project_id``).
  - Adds a NULLABLE ``series_id`` (FK series.id, ON DELETE SET NULL, indexed) to
    ``books`` — deleting a series must NOT delete its books (they fall back to
    project-only scope).
  - Adds a NULLABLE ``series_id`` (FK series.id, ON DELETE SET NULL, indexed) to
    ``codex_entries`` — NULL = project-global, set = series-scoped.

Portability (dialect split for the two ``series_id`` columns):
  - PostgreSQL: add each nullable column via plain ``ALTER TABLE``, then create
    the named ``ON DELETE SET NULL`` FK and index.
  - SQLite: add each column bare (``ALTER TABLE ... ADD COLUMN``, natively
    supported) plus the index, and SKIP the FK DDL. Adding an FK on SQLite needs
    a full table rebuild (batch mode), which is unreliable inside the single
    async (aiosqlite) migration transaction once another table has already been
    rebuilt in the same run. The model still declares the ``SET NULL`` FK, so it
    is authoritative on PostgreSQL and in the SQLite test tier (which builds the
    schema from the model via ``create_all``, not from this migration).

``series`` itself uses ``op.create_table`` (portable on both backends). The
initial-schema migration (``91516a452442``) is taught to skip ``series`` and the
two ``series_id`` columns so this revision owns them exactly once.

Verified: ``alembic upgrade head`` + ``downgrade base`` both run clean on SQLite.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3a1b2c3d4e5"
down_revision: str | Sequence[str] | None = "b2b1e2f3a4b5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "series",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "order_index", sa.Integer(), nullable=False, server_default="0"
        ),
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
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name="fk_series_project_id_projects",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_series_project_id", "series", ["project_id"], unique=False)

    # books.series_id / codex_entries.series_id — SET NULL so a series delete does
    # NOT delete the row (it falls back to project-only scope).
    #
    # Dialect split (deliberate — see the module docstring): on PostgreSQL we add
    # the column WITH a named FK via plain ``ALTER TABLE``. On SQLite a FK add
    # would require a full table rebuild (batch mode), which is unreliable inside
    # the single async (aiosqlite) migration transaction once another table has
    # been rebuilt; instead we add a bare nullable column (``ALTER TABLE ... ADD
    # COLUMN``, which SQLite supports natively) and skip the FK DDL. The model's
    # ``ondelete="SET NULL"`` FK is still authoritative on PostgreSQL and in the
    # SQLite test tier (which builds the schema from the model via ``create_all``,
    # not from this migration).
    is_postgres = op.get_bind().dialect.name == "postgresql"

    op.add_column(
        "books", sa.Column("series_id", sa.Uuid(as_uuid=True), nullable=True)
    )
    op.add_column(
        "codex_entries",
        sa.Column("series_id", sa.Uuid(as_uuid=True), nullable=True),
    )
    op.create_index("ix_books_series_id", "books", ["series_id"], unique=False)
    op.create_index(
        "ix_codex_entries_series_id", "codex_entries", ["series_id"], unique=False
    )

    if is_postgres:
        op.create_foreign_key(
            "fk_books_series_id_series",
            "books",
            "series",
            ["series_id"],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_foreign_key(
            "fk_codex_entries_series_id_series",
            "codex_entries",
            "series",
            ["series_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    """Downgrade schema."""
    # Mirror the dialect split from ``upgrade``: drop the named FKs only on
    # PostgreSQL (SQLite never created them — the column was added bare). The
    # indexes and columns drop natively on both backends (modern SQLite supports
    # ``ALTER TABLE ... DROP COLUMN``), avoiding the unreliable async-aiosqlite
    # batch table rebuild.
    is_postgres = op.get_bind().dialect.name == "postgresql"

    if is_postgres:
        op.drop_constraint(
            "fk_codex_entries_series_id_series",
            "codex_entries",
            type_="foreignkey",
        )
        op.drop_constraint(
            "fk_books_series_id_series", "books", type_="foreignkey"
        )

    op.drop_index("ix_codex_entries_series_id", table_name="codex_entries")
    op.drop_index("ix_books_series_id", table_name="books")
    op.drop_column("codex_entries", "series_id")
    op.drop_column("books", "series_id")

    op.drop_index("ix_series_project_id", table_name="series")
    op.drop_table("series")
