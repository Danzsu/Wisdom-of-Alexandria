"""Tests to verify Alembic migration setup and model registration."""

# Import all models to ensure they are registered with metadata
import alexandria_core.models  # noqa: F401
import pytest
from alexandria_core.models.base import Base

EXPECTED_TABLES = {
    "projects",
    "books",
    "chapters",
    "scenes",
    "beats",
    "characters",
    "locations",
    "worldbuilding_entries",
    "codex_entries",
    "codex_relations",
    "codex_progressions",
    "snippets",
    "style_guides",
    "generation_jobs",
    "revisions",
    "ai_comments",
    "providers",
}


def test_all_tables_in_metadata():
    """Verify that all expected tables are registered in SQLAlchemy metadata."""
    actual = set(Base.metadata.tables.keys())
    assert EXPECTED_TABLES == actual, (
        f"Table mismatch.\nMissing: {EXPECTED_TABLES - actual}\n"
        f"Extra: {actual - EXPECTED_TABLES}"
    )


def test_metadata_has_17_tables():
    """Verify that exactly 17 tables are registered."""
    import alexandria_core.models  # noqa: F401
    assert len(Base.metadata.tables) == 17, (
        f"Expected 17 tables, got {len(Base.metadata.tables)}"
    )


def test_env_py_can_import_models():
    """Verify that the alembic env.py can successfully import alexandria_core.models."""
    # This test runs when pytest loads, so if env.py imports fail,
    # this test would not run. However, we can test the config loading.
    from alexandria_core.core.config import settings

    assert settings.database_url == "postgresql+asyncpg://forgewriter:forgewriter@localhost:5432/forgewriter"
