"""add_media_assets_and_provider_image_model

Revision ID: f6a1b2c3d4e5
Revises: e5a1b2c3d4f6
Create Date: 2026-06-22 12:00:00.000000

Hand-written (Alembic autogenerate needs a live PostgreSQL connection, which the
local dev environment lacks). AI image generation, Phase 1:

  - Creates the ``media_assets`` table (metadata for generated images; the binary
    lives on the filesystem). CASCADE on project delete via ``project_id``.
  - Adds a NULLABLE ``image_model`` column to ``providers`` so a provider can
    declare which model to use for image generation (e.g.
    ``gemini/gemini-3.1-flash-image``). Mirrors ``embedding_model``.

Portability:
  - ``providers.image_model``: a plain nullable ``VARCHAR(255)`` works identically
    on PostgreSQL and the SQLite test database (mirrors ``b2a1c0d1e2f3``).
  - ``media_assets``: created via ``op.create_table`` (portable on both backends),
    matching ``c3a1b2c3d4e5``. The ``project_id`` FK is dialect-split exactly like
    ``e5a1b2c3d4f6``: on PostgreSQL the named ``ON DELETE CASCADE`` FK is created;
    on SQLite we create a bare column + index and SKIP the FK DDL (a SQLite FK add
    needs an unreliable batch table rebuild inside the single async aiosqlite
    migration transaction). The model still declares the CASCADE FK, so it is
    authoritative on PostgreSQL and in the SQLite test tier (which builds the
    schema from the model via ``create_all``, not from this migration).

These additions are owned EXACTLY by this revision: ``media_assets`` is added to
the initial-schema migration's (``91516a452442``) ``_TABLES_ADDED_LATER`` so it is
created here exactly once. ``providers`` is itself a later-added table (created by
``06f10715eb2b``), so ``image_model`` is simply added on top here, mirroring how
``embedding_model`` (``b2a1c0d1e2f3``) was added.

Verified: ``alembic upgrade head`` + ``downgrade -1`` + ``upgrade head`` all run
clean on SQLite.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f6a1b2c3d4e5"
down_revision: str | Sequence[str] | None = "e5a1b2c3d4f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1) providers.image_model — portable nullable VARCHAR(255) (mirrors
    # b2a1c0d1e2f3 embedding_model).
    op.add_column(
        "providers",
        sa.Column("image_model", sa.String(length=255), nullable=True),
    )

    # 2) media_assets — created portably via op.create_table. The projects FK is
    # dialect-split (named CASCADE FK on PostgreSQL only); on SQLite the column is
    # bare + indexed, the FK DDL is skipped (see the module docstring).
    is_postgres = op.get_bind().dialect.name == "postgresql"

    fk_constraints = []
    if is_postgres:
        fk_constraints.append(
            sa.ForeignKeyConstraint(
                ["project_id"],
                ["projects.id"],
                name="fk_media_assets_project_id_projects",
                ondelete="CASCADE",
            )
        )

    op.create_table(
        "media_assets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("entity_type", sa.String(length=32), nullable=False),
        sa.Column("entity_id", sa.Uuid(), nullable=True),
        sa.Column(
            "status", sa.String(length=20), nullable=False, server_default="generating"
        ),
        sa.Column("file_path", sa.String(length=512), nullable=True),
        sa.Column("thumb_path", sa.String(length=512), nullable=True),
        sa.Column(
            "mime", sa.String(length=50), nullable=False, server_default="image/png"
        ),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("model_name", sa.String(length=255), nullable=True),
        sa.Column("style", sa.String(length=100), nullable=True),
        sa.Column("prompt", sa.Text(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "is_canonical", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column("job_id", sa.Uuid(), nullable=True),
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
        sa.PrimaryKeyConstraint("id"),
        *fk_constraints,
    )
    op.create_index(
        "ix_media_assets_project_id", "media_assets", ["project_id"], unique=False
    )
    op.create_index(
        "ix_media_assets_entity_id", "media_assets", ["entity_id"], unique=False
    )
    op.create_index(
        "ix_media_assets_entity",
        "media_assets",
        ["entity_type", "entity_id"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_media_assets_entity", table_name="media_assets")
    op.drop_index("ix_media_assets_entity_id", table_name="media_assets")
    op.drop_index("ix_media_assets_project_id", table_name="media_assets")
    op.drop_table("media_assets")
    op.drop_column("providers", "image_model")
