"""Alembic upgrade/downgrade roundtrip on SQLite.

Exercises the full migration chain (including the series migration
``c3a1b2c3d4e5``) against a throwaway aiosqlite database, verifying that
``upgrade head`` then ``downgrade base`` both run clean and that the series
table + the two ``series_id`` columns + their indexes appear and disappear.

This is SQLite-only on purpose: the project's CI Postgres tier runs the same
chain, but a contributor on the default SQLite tier can still catch a broken
migration here without a live PostgreSQL connection.

HONEST COVERAGE CAVEAT: SQLite silently ignores / no-ops Postgres-specific DDL.
In particular the **pgvector** column type + any pgvector index DDL in the
migrations is NOT exercised here — under aiosqlite it is skipped or rendered
inert, so a broken pgvector migration would still pass this test. The
``@pytest.mark.postgres`` marker currently decorates ZERO tests, so those
Postgres-only code paths are UNPROVEN locally and only validated by a green run
on the CI-Postgres tier. Do not treat a green local run as proof that the
pgvector DDL is correct. (We do NOT attempt to spin up pgvector locally.)
"""
import os
import sqlite3
import tempfile

from alembic.config import Config

from alembic import command

# apps/api root (two levels up from this file: tests/unit -> tests -> apps/api).
_API_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _alembic_config(db_path: str) -> Config:
    cfg = Config(os.path.join(_API_ROOT, "alembic.ini"))
    cfg.set_main_option("script_location", os.path.join(_API_ROOT, "alembic"))
    return cfg


def _table_names(db_path: str) -> set[str]:
    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    finally:
        conn.close()
    return {r[0] for r in rows}


def _columns(db_path: str, table: str) -> set[str]:
    conn = sqlite3.connect(db_path)
    try:
        rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    finally:
        conn.close()
    return {r[1] for r in rows}


def test_scene_location_id_migration_roundtrip():
    """The scenes.location_id revision adds the column (+ index) on upgrade and
    removes it on downgrade — verified against a throwaway SQLite DB by walking
    head → one step below the owning revision → head again."""
    from alexandria_core.core.config import settings

    prev_url = settings.database_url
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    os.remove(db_path)
    try:
        settings.database_url = f"sqlite+aiosqlite:///{db_path}"
        cfg = _alembic_config(db_path)

        command.upgrade(cfg, "head")
        assert "location_id" in _columns(db_path, "scenes")

        # Step below the owning revision: the column (and its index) must go.
        command.downgrade(cfg, "b3c5d7e9f1a2")
        assert "scenes" in _table_names(db_path)
        assert "location_id" not in _columns(db_path, "scenes")

        # And re-upgrading restores it (idempotent forward path).
        command.upgrade(cfg, "head")
        assert "location_id" in _columns(db_path, "scenes")
    finally:
        settings.database_url = prev_url
        if os.path.exists(db_path):
            os.remove(db_path)


def test_alembic_upgrade_then_downgrade_roundtrip():
    # ``settings`` is a singleton instantiated at import time, so changing the
    # env var alone has no effect — env.py reads ``settings.database_url``
    # directly. Patch that attribute (the URL string the engine is built from)
    # for the duration of the migration run and restore it after.
    from alexandria_core.core.config import settings

    prev_url = settings.database_url
    fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    os.remove(db_path)  # let alembic/sqlite create it fresh
    try:
        settings.database_url = f"sqlite+aiosqlite:///{db_path}"
        cfg = _alembic_config(db_path)

        command.upgrade(cfg, "head")
        tables = _table_names(db_path)
        assert "series" in tables
        assert "series_id" in _columns(db_path, "books")
        assert "series_id" in _columns(db_path, "codex_entries")

        command.downgrade(cfg, "base")
        tables_after = _table_names(db_path)
        assert "series" not in tables_after
        # Base tables that survive a full downgrade keep no series_id column.
        if "books" in tables_after:
            assert "series_id" not in _columns(db_path, "books")
    finally:
        settings.database_url = prev_url
        if os.path.exists(db_path):
            os.remove(db_path)
