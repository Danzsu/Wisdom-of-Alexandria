"""add books.author

Revision ID: a7b3c1d2e4f5
Revises: f6a1b2c3d4e5
Create Date: 2026-06-23 10:00:00.000000

Hand-written migration. Adds a nullable ``author`` VARCHAR(255) column to the
``books`` table. Used for the cover-generator byline and (later) export
headers. Optional — single-user app has no user-profile name to default from.

Portability: plain ``op.add_column`` with a nullable String works identically
on PostgreSQL and the SQLite test database (mirrors ``b2a1c0d1e2f3``
embedding_model and ``f6a1b2c3d4e5`` image_model).

Verified: ``alembic upgrade head`` + ``downgrade -1`` + ``upgrade head`` run
clean on SQLite.
"""
import sqlalchemy as sa

from alembic import op

revision = "a7b3c1d2e4f5"
down_revision = "f6a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("books", sa.Column("author", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("books", "author")
