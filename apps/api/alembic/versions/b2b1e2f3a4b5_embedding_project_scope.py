"""embedding_project_scope

Revision ID: b2b1e2f3a4b5
Revises: b2a2d3e4f5a6
Create Date: 2026-06-16 10:00:00.000000

Hand-written (Alembic autogenerate needs a live PostgreSQL connection, which the
local dev environment lacks). B2b scope refinement: RAG operates at the PROJECT
level, not the book level.

  - Adds a NON-null ``project_id`` (FK projects.id, ON DELETE CASCADE, indexed)
    to ``embeddings`` — the primary retrieval scope for every row.
  - Makes ``book_id`` NULLABLE: it is now provenance only, set for manuscript
    entities (scene/chapter) and NULL for project-scoped entities.

Portability:
  - There is no data in ``embeddings`` yet (the table was added in the prior
    revision and nothing has been indexed), so adding a NOT NULL column with no
    backfill is safe on PostgreSQL.
  - ``project_id`` is added inside a ``batch_alter_table`` so the FK is created
    portably (SQLite cannot ``ALTER TABLE ... ADD CONSTRAINT``; batch mode
    rebuilds the table). The same batch context relaxes ``book_id`` to nullable
    (SQLite has no ``ALTER COLUMN``). On PostgreSQL batch mode emits plain
    ``ALTER TABLE`` statements.

This migration is portable across both backends; the SQLite test tier itself
builds the schema with ``create_all`` (this file is kept importable + correct).
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2b1e2f3a4b5"
down_revision: str | Sequence[str] | None = "b2a2d3e4f5a6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # batch_alter_table makes both changes portable to SQLite (table rebuild) and
    # remains a normal set of ALTERs on PostgreSQL. Named FK/constraint so the
    # downgrade can drop it deterministically.
    with op.batch_alter_table("embeddings", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column("project_id", sa.Uuid(as_uuid=True), nullable=False)
        )
        batch_op.create_foreign_key(
            "fk_embeddings_project_id_projects",
            "projects",
            ["project_id"],
            ["id"],
            ondelete="CASCADE",
        )
        batch_op.create_index(
            "ix_embeddings_project_id", ["project_id"], unique=False
        )
        # book_id becomes nullable (provenance only).
        batch_op.alter_column(
            "book_id",
            existing_type=sa.Uuid(as_uuid=True),
            nullable=True,
        )


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table("embeddings", schema=None) as batch_op:
        batch_op.alter_column(
            "book_id",
            existing_type=sa.Uuid(as_uuid=True),
            nullable=False,
        )
        batch_op.drop_index("ix_embeddings_project_id")
        batch_op.drop_constraint(
            "fk_embeddings_project_id_projects", type_="foreignkey"
        )
        batch_op.drop_column("project_id")
