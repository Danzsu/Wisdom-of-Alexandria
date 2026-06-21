"""add_generation_job_project_id

Revision ID: e5a1b2c3d4f6
Revises: d4a1b2c3e5f6
Create Date: 2026-06-21 12:00:00.000000

Hand-written (Alembic autogenerate needs a live PostgreSQL connection, which the
local dev environment lacks). P1L-1 — async RAG index job:

  - Adds a NULLABLE ``project_id`` (FK projects.id, ON DELETE CASCADE, indexed)
    to ``generation_jobs`` so a project-level job (the async RAG index rebuild)
    can be located + polled per project. CASCADE so deleting a project removes
    its jobs. NULL for the existing scene/chapter-scoped generation jobs.

Portability (dialect split for the ``project_id`` column):
  - PostgreSQL: add the nullable column via plain ``ALTER TABLE``, then create
    the named ``ON DELETE CASCADE`` FK and the index.
  - SQLite: add the column bare (``ALTER TABLE ... ADD COLUMN``, natively
    supported) plus the index, and SKIP the FK DDL. Adding an FK on SQLite needs
    a full table rebuild (batch mode), which is unreliable inside the single
    async (aiosqlite) migration transaction. The model still declares the
    ``CASCADE`` FK, so it is authoritative on PostgreSQL and in the SQLite test
    tier (which builds the schema from the model via ``create_all``, not from
    this migration).

The column is owned EXACTLY by this revision: the initial-schema migration
(``91516a452442`` ``_COLUMNS_ADDED_LATER``) is taught to strip
``generation_jobs.project_id`` so it is created here exactly once.

Verified: ``alembic upgrade head`` + ``downgrade base`` both run clean on SQLite
and against PostgreSQL.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5a1b2c3d4f6"
down_revision: str | Sequence[str] | None = "d4a1b2c3e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Dialect split (deliberate — see the module docstring): on PostgreSQL add
    # the column then the named CASCADE FK; on SQLite add a bare column + index
    # and skip the FK DDL (a SQLite FK add needs an unreliable batch rebuild).
    is_postgres = op.get_bind().dialect.name == "postgresql"

    op.add_column(
        "generation_jobs",
        sa.Column("project_id", sa.Uuid(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_generation_jobs_project_id",
        "generation_jobs",
        ["project_id"],
        unique=False,
    )
    if is_postgres:
        op.create_foreign_key(
            "fk_generation_jobs_project_id_projects",
            "generation_jobs",
            "projects",
            ["project_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    """Downgrade schema."""
    # Mirror the dialect split: drop the named FK only on PostgreSQL (SQLite
    # never created it). The index + column drop natively on both backends.
    is_postgres = op.get_bind().dialect.name == "postgresql"

    if is_postgres:
        op.drop_constraint(
            "fk_generation_jobs_project_id_projects",
            "generation_jobs",
            type_="foreignkey",
        )
    op.drop_index("ix_generation_jobs_project_id", table_name="generation_jobs")
    op.drop_column("generation_jobs", "project_id")
