"""add_providers_table

Revision ID: 06f10715eb2b
Revises: 91516a452442
Create Date: 2026-06-15 12:00:00.000000

Hand-written: Alembic autogenerate requires a live PostgreSQL connection, which
is not available in the local dev environment. This migration creates the
``providers`` table that backs AI provider / API-key configuration. It mirrors
``app.models.provider.Provider`` and is compatible with both PostgreSQL and the
SQLite test database.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "06f10715eb2b"
down_revision: str | Sequence[str] | None = "91516a452442"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "providers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=False),
        sa.Column("api_key_encrypted", sa.Text(), nullable=True),
        sa.Column("base_url", sa.String(length=512), nullable=True),
        sa.Column("default_model", sa.String(length=255), nullable=True),
        sa.Column(
            "enabled", sa.Boolean(), nullable=False, server_default=sa.true()
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
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("providers")
