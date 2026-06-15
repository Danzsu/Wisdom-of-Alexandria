"""add_codex_aliases_role

Revision ID: a1c4d7e9f2b3
Revises: 06f10715eb2b
Create Date: 2026-06-15 13:00:00.000000

Hand-written: Alembic autogenerate requires a live PostgreSQL connection, which
is not available in the local dev environment. This migration adds the dedicated
``aliases`` (JSON list) + ``role`` (nullable string) columns to ``codex_entries``,
mirroring ``app.models.character.Character`` so a generic codex card carries the
same recognition names + story role as a Character. It replaces the frontend's
interim ``__woa:`` namespaced tags codec (see ``apps/web/lib/api/codex.ts``).

Compatible with both PostgreSQL and the SQLite test database:
  - ``aliases`` is JSON with a permanent ``"[]"`` server_default so existing rows
    backfill to an empty list and a raw DB insert matches the model's
    ``default=list``. The default is intentionally NOT dropped afterwards:
    ``ALTER COLUMN … DROP DEFAULT`` is unsupported on SQLite (and a no-op-equivalent
    on Postgres given the same value), so keeping it is the portable choice.
  - ``role`` is a plain nullable ``VARCHAR(100)``.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1c4d7e9f2b3"
down_revision: str | Sequence[str] | None = "06f10715eb2b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add aliases with an empty-list server_default so existing rows backfill
    # without a NULL surprise. The default is kept (not dropped) for SQLite
    # portability — see the module docstring.
    op.add_column(
        "codex_entries",
        sa.Column(
            "aliases",
            sa.JSON(),
            nullable=True,
            server_default=sa.text("'[]'"),
        ),
    )
    op.add_column(
        "codex_entries",
        sa.Column("role", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("codex_entries", "role")
    op.drop_column("codex_entries", "aliases")
