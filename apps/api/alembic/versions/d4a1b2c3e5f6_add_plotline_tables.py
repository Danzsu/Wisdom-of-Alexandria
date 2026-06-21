"""add_plotline_tables

Revision ID: d4a1b2c3e5f6
Revises: c3b2d4e5f6a7
Create Date: 2026-06-21 10:00:00.000000

Hand-written (Alembic autogenerate needs a live PostgreSQL connection, which the
local dev environment lacks). Feature Plotline-a — subplot / narrative-thread
(cselekményszál) domain:

  - Creates the ``plotlines`` table: a subplot under a Project (CASCADE on
    project delete via ``project_id``) optionally scoped to a single ``book_id``
    (FK books.id, ON DELETE SET NULL — deleting the book must NOT delete the
    plotline; it falls back to project-wide scope).
  - Creates the ``plotline_scenes`` association table linking scenes to a
    plotline (``related_scenes[]``): ``plotline_id`` (CASCADE) + ``scene_id``
    (CASCADE), a UNIQUE (plotline_id, scene_id) so a scene can't be attached
    twice, plus per-FK indexes.

Portability:
  Both tables are BRAND NEW, so every FK lives inside ``op.create_table``
  (portable on PostgreSQL and SQLite alike — no after-the-fact ``ALTER TABLE ...
  ADD CONSTRAINT`` that would require an unreliable SQLite batch rebuild inside
  the single async/aiosqlite migration transaction). This differs from
  ``c3a1b2c3d4e5``'s dialect split only because that revision had to ADD FK
  columns to PRE-EXISTING tables (``books`` / ``codex_entries``); here there is
  no pre-existing table to alter, so no split is needed.

The two tables are owned EXACTLY by this revision: the initial-schema migration
(``91516a452442`` ``_TABLES_ADDED_LATER``) is taught to skip ``plotlines`` and
``plotline_scenes`` so they are created here exactly once.

Verified: ``alembic upgrade head`` + ``downgrade base`` both run clean on SQLite.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d4a1b2c3e5f6"
down_revision: str | Sequence[str] | None = "c3b2d4e5f6a7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "plotlines",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("book_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("plotline_type", sa.String(length=50), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
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
            name="fk_plotlines_project_id_projects",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["book_id"],
            ["books.id"],
            name="fk_plotlines_book_id_books",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_plotlines_project_id", "plotlines", ["project_id"], unique=False
    )
    op.create_index(
        "ix_plotlines_book_id", "plotlines", ["book_id"], unique=False
    )

    op.create_table(
        "plotline_scenes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("plotline_id", sa.Uuid(), nullable=False),
        sa.Column("scene_id", sa.Uuid(), nullable=False),
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
            ["plotline_id"],
            ["plotlines.id"],
            name="fk_plotline_scenes_plotline_id_plotlines",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["scene_id"],
            ["scenes.id"],
            name="fk_plotline_scenes_scene_id_scenes",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "plotline_id",
            "scene_id",
            name="uq_plotline_scenes_plotline_scene",
        ),
    )
    op.create_index(
        "ix_plotline_scenes_plotline_id",
        "plotline_scenes",
        ["plotline_id"],
        unique=False,
    )
    op.create_index(
        "ix_plotline_scenes_scene_id",
        "plotline_scenes",
        ["scene_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(
        "ix_plotline_scenes_scene_id", table_name="plotline_scenes"
    )
    op.drop_index(
        "ix_plotline_scenes_plotline_id", table_name="plotline_scenes"
    )
    op.drop_table("plotline_scenes")

    op.drop_index("ix_plotlines_book_id", table_name="plotlines")
    op.drop_index("ix_plotlines_project_id", table_name="plotlines")
    op.drop_table("plotlines")
