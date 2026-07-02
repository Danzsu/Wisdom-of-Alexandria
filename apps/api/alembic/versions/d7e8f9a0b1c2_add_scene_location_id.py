"""add_scene_location_id

Revision ID: d7e8f9a0b1c2
Revises: b3c5d7e9f1a2
Create Date: 2026-07-02 10:00:00.000000

Hand-written (Alembic autogenerate needs a live PostgreSQL connection, which the
local dev environment lacks). Data-model gap: a scene could reference its POV
character (``pov_character_id``) but not WHERE it takes place.

  - Adds a NULLABLE ``location_id`` (FK locations.id, ON DELETE SET NULL,
    indexed) to ``scenes``, mirroring ``pov_character_id``. SET NULL so deleting
    a Codex location detaches it from scenes instead of deleting them.

Portability (dialect split — same recipe as ``e5a1b2c3d4f6``):
  - PostgreSQL: add the nullable column via plain ``ALTER TABLE``, then create
    the named ``ON DELETE SET NULL`` FK and the index.
  - SQLite: add the column bare (``ALTER TABLE ... ADD COLUMN``, natively
    supported) plus the index, and SKIP the FK DDL. Adding an FK on SQLite needs
    a full table rebuild (batch mode), which is unreliable inside the single
    async (aiosqlite) migration transaction. The model still declares the
    ``SET NULL`` FK, so it is authoritative on PostgreSQL and in the SQLite test
    tier (which builds the schema from the model via ``create_all``, not from
    this migration).

Ownership + idempotency (the two conventions this repo uses together):
  - The initial-schema migration (``91516a452442`` ``_COLUMNS_ADDED_LATER``) is
    taught to strip ``scenes.location_id``, so on a FRESH ``upgrade base→head``
    this revision creates the column exactly once (the ``e5a1b2c3d4f6`` pattern).
  - Belt-and-braces existence guards (the ``a8c4e1f2b3d4`` pattern): a dev DB
    built by ``create_all`` off the LIVE models — which now declare the column +
    ``index=True`` — and later stamped/migrated must NOT fail on a duplicate
    column/index, so both DDL statements are skipped when already present. The
    FK is only created when this revision actually created the column (a
    create_all-built PostgreSQL DB already carries the model-declared FK).
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d7e8f9a0b1c2"
down_revision: str | Sequence[str] | None = "b3c5d7e9f1a2"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_INDEX_NAME = "ix_scenes_location_id"
_FK_NAME = "fk_scenes_location_id_locations"


def _scene_columns(bind) -> set[str]:
    return {c["name"] for c in sa.inspect(bind).get_columns("scenes")}


def _scene_indexes(bind) -> set[str]:
    return {ix["name"] for ix in sa.inspect(bind).get_indexes("scenes")}


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    column_created = False
    if "location_id" not in _scene_columns(bind):
        op.add_column(
            "scenes",
            sa.Column("location_id", sa.Uuid(as_uuid=True), nullable=True),
        )
        column_created = True

    if _INDEX_NAME not in _scene_indexes(bind):
        op.create_index(_INDEX_NAME, "scenes", ["location_id"], unique=False)

    # Named FK on PostgreSQL only, and only when THIS revision created the
    # column (a create_all-built DB already has the model-declared FK).
    if is_postgres and column_created:
        op.create_foreign_key(
            _FK_NAME,
            "scenes",
            "locations",
            ["location_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # Drop the named FK only where it exists (PostgreSQL; SQLite never created
    # it, and a create_all-built DB carries an auto-named model FK instead).
    if is_postgres:
        fk_names = {
            fk["name"] for fk in sa.inspect(bind).get_foreign_keys("scenes")
        }
        if _FK_NAME in fk_names:
            op.drop_constraint(_FK_NAME, "scenes", type_="foreignkey")

    # The index must go BEFORE the column (SQLite refuses to drop an indexed
    # column). Guarded like the upgrade path — see the module docstring for the
    # intentional create_all asymmetry (a later upgrade re-adds both).
    if _INDEX_NAME in _scene_indexes(bind):
        op.drop_index(_INDEX_NAME, table_name="scenes")
    if "location_id" in _scene_columns(bind):
        op.drop_column("scenes", "location_id")
