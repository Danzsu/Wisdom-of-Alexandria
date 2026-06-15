"""add_provider_embedding_model

Revision ID: b2a1c0d1e2f3
Revises: a1c4d7e9f2b3
Create Date: 2026-06-15 18:00:00.000000

Hand-written (Alembic autogenerate needs a live PostgreSQL connection, which the
local dev environment lacks). Adds the nullable ``embedding_model`` column to
``providers`` so a provider can declare which model to use for RAG embeddings.

Recommended cloud default: OpenAI ``text-embedding-3-small`` (1536-dim).

Portable add_column (mirrors ``a1c4d7e9f2b3``): a plain nullable
``VARCHAR(255)`` works identically on PostgreSQL and the SQLite test database.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2a1c0d1e2f3"
down_revision: str | Sequence[str] | None = "a1c4d7e9f2b3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "providers",
        sa.Column("embedding_model", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("providers", "embedding_model")
