"""add_generation_job_book_id

Revision ID: e9f0a1b2c3d4
Revises: d7e8f9a0b1c2
Create Date: 2026-07-02 12:00:00.000000

Hand-written (Alembic autogenerate needs a live PostgreSQL connection, which the
local dev environment lacks). Visibility gap: book-level jobs (job_type
``book_generate``) were only project-scoped, so the book-scoped jobs listing
(``GET /jobs?book_id=`` — which resolves membership via scene/chapter linkage)
could never include them.

  - Adds a NULLABLE ``book_id`` (indexed, NO FK) to ``generation_jobs``,
    mirroring the existing plain ``chapter_id`` column: the AI service shares
    the table via ``alexandria_core`` but must not cascade-manage books, so the
    column intentionally carries no foreign key on any dialect.

Portability: with no FK there is no dialect split — the same plain
``ALTER TABLE ... ADD COLUMN`` + ``CREATE INDEX`` runs on PostgreSQL and SQLite.

Ownership + idempotency (the two conventions this repo uses together):
  - The initial-schema migration (``91516a452442`` ``_COLUMNS_ADDED_LATER``) is
    taught to strip ``generation_jobs.book_id``, so on a FRESH ``upgrade
    base→head`` this revision creates the column exactly once (the
    ``e5a1b2c3d4f6`` pattern).
  - Belt-and-braces existence guards (the ``a8c4e1f2b3d4`` pattern): a dev DB
    built by ``create_all`` off the LIVE models — which now declare the column +
    ``index=True`` — and later stamped/migrated must NOT fail on a duplicate
    column/index, so both DDL statements are skipped when already present.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e9f0a1b2c3d4"
down_revision: str | Sequence[str] | None = "d7e8f9a0b1c2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INDEX_NAME = "ix_generation_jobs_book_id"


def _job_columns(bind) -> set[str]:
    return {c["name"] for c in sa.inspect(bind).get_columns("generation_jobs")}


def _job_indexes(bind) -> set[str]:
    return {ix["name"] for ix in sa.inspect(bind).get_indexes("generation_jobs")}


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()

    if "book_id" not in _job_columns(bind):
        op.add_column(
            "generation_jobs",
            sa.Column("book_id", sa.Uuid(as_uuid=True), nullable=True),
        )

    if _INDEX_NAME not in _job_indexes(bind):
        op.create_index(_INDEX_NAME, "generation_jobs", ["book_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()

    # The index must go BEFORE the column (SQLite refuses to drop an indexed
    # column). Guarded like the upgrade path.
    if _INDEX_NAME in _job_indexes(bind):
        op.drop_index(_INDEX_NAME, table_name="generation_jobs")
    if "book_id" in _job_columns(bind):
        op.drop_column("generation_jobs", "book_id")
