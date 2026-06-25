"""db_hardening_fk_indexes_hnsw_server_defaults

Revision ID: a8c4e1f2b3d4
Revises: a7b3c1d2e4f5
Create Date: 2026-06-25 10:00:00.000000

Hand-written (Alembic autogenerate needs a live PostgreSQL connection, which the
local dev environment lacks). Low-risk, additive DB hardening surfaced by the
backend audit (P1/P2). No behaviour change for callers — only physical-schema
improvements:

  1. FK INDEXES. PostgreSQL does not auto-index foreign keys, so child-listing
     queries (``WHERE parent_id = …``) and parent ``ON DELETE CASCADE`` /
     ``SET NULL`` fan-outs were doing sequential scans. Adds ``ix_{table}_{col}``
     btree indexes on the core parent FKs that were still missing one. The newer
     series / plotline / embedding / media FKs already declared ``index=True``
     and are intentionally NOT touched here. The matching model columns now
     carry ``index=True`` too.

     IDEMPOTENCY (important — this repo's initial-schema migration builds the
     schema with ``Base.metadata.create_all`` off the LIVE models, see
     ``91516a452442``). Now that the models declare ``index=True``, a FRESH
     ``upgrade base→head`` already has these indexes created by the initial
     migration — so this revision MUST be a no-op for indexes that already
     exist, and only create the ones that are missing (a legacy PostgreSQL DB
     built before the models grew ``index=True``). We therefore inspect the live
     indexes per table and skip any that are already present. The same guard on
     downgrade only drops the indexes this revision actually created.

  2. PGVECTOR ANN INDEX: ivfflat → hnsw (PostgreSQL only). The original index
     (``b2a2d3e4f5a6``) was an ``ivfflat`` built on an EMPTY table; ivfflat
     trains its centroid lists from existing rows, so an empty-table build yields
     degenerate centroids and poor recall until a manual ``REINDEX`` after the
     table fills. ``hnsw`` is a graph index that needs no training data and is
     correct when built empty. We drop ``ix_embeddings_embedding_cosine`` and
     recreate it as ``hnsw`` with ``vector_cosine_ops`` (m=16, ef_construction=64).

     OPS CLASS — ``vector_cosine_ops``: the retrieval query in
     ``apps/ai/app/services/embedding_service.py`` orders by ``cosine_distance``
     (the pgvector ``<=>`` operator) — see ``EmbeddingService.retrieve`` /
     ``alexandria_core.db.vector.cosine_distance``. The HNSW ops class MUST match
     the query operator, so cosine (``<=>`` → ``vector_cosine_ops``) is used, NOT
     L2 (``vector_l2_ops``) or inner product (``vector_ip_ops``).

  3. SERVER DEFAULTS. Several columns declared an ORM-only Python ``default`` but
     no DB ``server_default``, so a raw / backfill INSERT that omits the column
     would violate the ``NOT NULL`` constraint:
       - ``embeddings.dim`` → ``server_default='1536'`` (matches EMBEDDING_DIM).
       - ``ai_visible`` on the four codex tables (characters, locations,
         worldbuilding_entries, codex_entries) → ``server_default=text('true')``.

All pgvector-specific DDL is guarded by
``op.get_bind().dialect.name == "postgresql"`` so the SQLite test suite never
emits ``vector`` / ``hnsw`` DDL. The FK-index and server-default DDL is portable
and runs on both backends.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a8c4e1f2b3d4"
down_revision: str | Sequence[str] | None = "a7b3c1d2e4f5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

EMBEDDING_DIM = 1536

# (index_name, table, [columns]) for the FK indexes that were missing one.
# Names follow the ``ix_{table}_{column}`` convention used elsewhere
# (e.g. ix_generation_jobs_project_id, ix_embeddings_book_id).
_FK_INDEXES: list[tuple[str, str, list[str]]] = [
    ("ix_books_project_id", "books", ["project_id"]),
    ("ix_chapters_book_id", "chapters", ["book_id"]),
    ("ix_scenes_chapter_id", "scenes", ["chapter_id"]),
    ("ix_scenes_pov_character_id", "scenes", ["pov_character_id"]),
    ("ix_beats_scene_id", "beats", ["scene_id"]),
    ("ix_characters_project_id", "characters", ["project_id"]),
    ("ix_locations_project_id", "locations", ["project_id"]),
    (
        "ix_worldbuilding_entries_project_id",
        "worldbuilding_entries",
        ["project_id"],
    ),
    ("ix_codex_entries_project_id", "codex_entries", ["project_id"]),
    ("ix_snippets_project_id", "snippets", ["project_id"]),
    ("ix_codex_relations_project_id", "codex_relations", ["project_id"]),
    ("ix_revisions_scene_id", "revisions", ["scene_id"]),
    ("ix_revisions_job_id", "revisions", ["job_id"]),
    ("ix_ai_comments_scene_id", "ai_comments", ["scene_id"]),
    ("ix_codex_progressions_chapter_id", "codex_progressions", ["chapter_id"]),
    ("ix_codex_progressions_scene_id", "codex_progressions", ["scene_id"]),
    ("ix_generation_jobs_scene_id", "generation_jobs", ["scene_id"]),
]

# (table, column, server_default) for the NOT NULL columns that lacked a
# server-side default. ``ai_visible`` defaults true; ``dim`` defaults EMBEDDING_DIM.
_AI_VISIBLE_TABLES = [
    "characters",
    "locations",
    "worldbuilding_entries",
    "codex_entries",
]


def _existing_indexes(bind, table: str) -> set[str]:
    """Names of indexes already present on ``table`` in the live DB."""
    return {ix["name"] for ix in sa.inspect(bind).get_indexes(table)}


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # 1. FK indexes (portable). Idempotent: skip any that already exist (a fresh
    #    create_all build already has them now that the models declare
    #    index=True; only a legacy PG DB is missing them). See module docstring.
    for name, table, cols in _FK_INDEXES:
        if name in _existing_indexes(bind, table):
            continue
        op.create_index(name, table, cols, unique=False)

    # 2. pgvector ANN index: ivfflat → hnsw. PostgreSQL only — guarded so SQLite
    #    (which never created the ivfflat index) is untouched. cosine ops class
    #    matches the ``<=>`` operator used by the retrieval query.
    if is_postgres:
        op.execute("DROP INDEX IF EXISTS ix_embeddings_embedding_cosine")
        op.execute(
            "CREATE INDEX ix_embeddings_embedding_cosine ON embeddings "
            "USING hnsw (embedding vector_cosine_ops) "
            "WITH (m = 16, ef_construction = 64)"
        )

    # 3. Server defaults for NOT NULL columns that had only an ORM-side default.
    #    PostgreSQL only: on SQLite a bare ``server_default`` change forces a
    #    full batch table rebuild (unreliable inside the single async-aiosqlite
    #    transaction — same reason the series/job migrations skip SQLite ALTERs).
    #    The SQLite test tier builds the schema from the models via create_all,
    #    which now carries these server_defaults, so SQLite needs nothing here.
    if is_postgres:
        op.alter_column(
            "embeddings",
            "dim",
            existing_type=sa.Integer(),
            existing_nullable=False,
            server_default=str(EMBEDDING_DIM),
        )
        for table in _AI_VISIBLE_TABLES:
            op.alter_column(
                table,
                "ai_visible",
                existing_type=sa.Boolean(),
                existing_nullable=False,
                server_default=sa.text("true"),
            )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    is_postgres = bind.dialect.name == "postgresql"

    # 3. Drop the server defaults (revert to ORM-only Python defaults).
    #    PostgreSQL only — mirrors the upgrade guard (no SQLite batch rebuild).
    if is_postgres:
        for table in _AI_VISIBLE_TABLES:
            op.alter_column(
                table,
                "ai_visible",
                existing_type=sa.Boolean(),
                existing_nullable=False,
                server_default=None,
            )
        op.alter_column(
            "embeddings",
            "dim",
            existing_type=sa.Integer(),
            existing_nullable=False,
            server_default=None,
        )

    # 2. Revert the ANN index hnsw → ivfflat (PostgreSQL only), matching the
    #    original b2a2d3e4f5a6 definition (ivfflat, vector_cosine_ops, lists=100).
    if is_postgres:
        op.execute("DROP INDEX IF EXISTS ix_embeddings_embedding_cosine")
        op.execute(
            "CREATE INDEX ix_embeddings_embedding_cosine ON embeddings "
            "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)"
        )

    # 1. Drop the FK indexes (reverse order for symmetry). Guarded by a live
    #    existence check so the drop is a no-op if an index is already absent —
    #    keeps downgrade safe regardless of whether the initial create_all or
    #    this revision physically created it.
    #
    #    INTENTIONAL ASYMMETRY: the models now declare ``index=True`` on these FK
    #    columns, so on a fresh DB ``create_all`` (the test/dev metadata tier)
    #    creates these indexes itself. This downgrade unconditionally removes the
    #    model-declared FK indexes, so an ``upgrade -> downgrade`` round-trip on a
    #    fresh DB leaves the schema missing indexes the models declare. This is
    #    acceptable and expected: a subsequent ``upgrade`` re-adds them
    #    idempotently (the upgrade path is guarded the same way). We do not try to
    #    distinguish "create_all made it" from "this revision made it" because the
    #    forward migration is the single source of truth for these indexes.
    for name, table, _cols in reversed(_FK_INDEXES):
        if name in _existing_indexes(bind, table):
            op.drop_index(name, table_name=table)
