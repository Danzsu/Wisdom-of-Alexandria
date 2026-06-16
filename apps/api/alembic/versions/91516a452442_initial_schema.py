"""initial_schema

Revision ID: 91516a452442
Revises:
Create Date: 2026-06-09 22:54:47.531040

Builds the base schema (everything that existed BEFORE the first incremental
migration ``06f10715eb2b_add_providers_table``). This migration was previously an
empty stub because the test/dev tiers build the schema with
``Base.metadata.create_all`` rather than Alembic, so ``alembic upgrade head`` was
never run end-to-end. C0 wires migrations into CI (``alembic upgrade head`` on a
fresh PostgreSQL), so the base tables must actually be created here for the later
incremental migrations (aliases/role ALTER on ``codex_entries``, the ``providers``
table, the ``embeddings`` table + pgvector) to apply on top.

Implementation note — why we filter ``Base.metadata`` instead of hand-writing
every ``create_table``:
  - The ORM ``Base.metadata`` is the single source of truth for the schema and is
    already what the test suites create_all. Re-deriving 16 tables by hand would
    duplicate that and drift.
  - We create every table EXCEPT the ones introduced by later revisions
    (``providers`` -> 06f10715eb2b, ``embeddings`` -> b2a2d3e4f5a6) and we DROP
    the columns added by later revisions (``codex_entries.aliases`` / ``role`` ->
    a1c4d7e9f2b3) from the in-memory copy, so those incremental migrations add
    them exactly once with no collision.
  - We work on a deep-copied ``MetaData`` (``to_metadata``) so the live ORM
    metadata used by the running app/tests is never mutated.

Portable across PostgreSQL (CI) and SQLite (this file stays importable; the
SQLite test tier still uses create_all and never runs this migration).
"""
from collections.abc import Sequence

from sqlalchemy import MetaData

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '91516a452442'
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Tables introduced by LATER revisions — excluded from the initial schema so the
# migration that owns each one creates it exactly once.
_TABLES_ADDED_LATER = {"providers", "embeddings", "series"}

# Columns added by LATER revisions to base tables — dropped from the in-memory
# copy here so the owning ALTER migration adds them exactly once.
_COLUMNS_ADDED_LATER = {
    # aliases/role -> a1c4d7e9f2b3 ; series_id -> c3a1b2c3d4e5
    "codex_entries": {"aliases", "role", "series_id"},
    "books": {"series_id"},  # -> c3a1b2c3d4e5
}


def _drop_later_column(copied, col_name: str) -> None:
    """Remove a later-added column (its FK and any index) from the copy.

    Dropped first so ``create_all`` does not emit, for a column the owning later
    revision creates (e.g. ``series_id`` -> the later-owned ``series`` table):
      - a dangling FK to an excluded table, or
      - a ``CREATE INDEX`` over a column that no longer exists here.
    """
    if col_name not in copied.columns:
        return
    col = copied.columns[col_name]
    # Drop any index that references this column (e.g. ix_books_series_id).
    for index in {idx for idx in copied.indexes if col_name in idx.columns.keys()}:
        copied.indexes.discard(index)
    for fk in set(col.foreign_keys):
        copied.constraints.discard(fk.constraint)
        copied.foreign_keys.discard(fk)
    copied._columns.remove(col)


def _base_metadata() -> MetaData:
    """A deep copy of the ORM metadata reduced to the pre-providers schema."""
    import alexandria_core.models  # noqa: F401 — registers all ORM models on Base
    from alexandria_core.models.base import Base

    base = MetaData()
    for table in Base.metadata.tables.values():
        if table.name in _TABLES_ADDED_LATER:
            continue
        copied = table.to_metadata(base)
        for col_name in _COLUMNS_ADDED_LATER.get(table.name, set()):
            _drop_later_column(copied, col_name)
    return base


def upgrade() -> None:
    """Upgrade schema."""
    _base_metadata().create_all(bind=op.get_bind())


def downgrade() -> None:
    """Downgrade schema."""
    _base_metadata().drop_all(bind=op.get_bind())
