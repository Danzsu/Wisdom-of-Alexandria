"""Tests for the Embedding model + dialect-aware Vector column (B2a).

SQLite-safe: the model loads under create_all (the shared engine fixture already
ran it) and an insert/read round-trips the vector as a plain list[float] via the
JSON fallback. The postgres-marked test exercises the real ``vector`` column and
is skipped automatically on SQLite.
"""

import uuid

import pytest
from alexandria_core.models.book import Book
from alexandria_core.models.embedding import Embedding
from alexandria_core.models.project import Project
from sqlalchemy import select

from tests.conftest import IS_POSTGRES


async def _make_book(db_session) -> uuid.UUID:
    project = Project(title="Embed proj")
    db_session.add(project)
    await db_session.flush()
    book = Book(project_id=project.id, title="Embed book")
    db_session.add(book)
    await db_session.flush()
    await db_session.commit()
    return book.id


@pytest.mark.integration
async def test_embedding_inserts_and_round_trips_vector_on_sqlite(db_session):
    book_id = await _make_book(db_session)
    entity_id = uuid.uuid4()
    vec = [0.1, 0.2, 0.3, -0.4]
    row = Embedding(
        book_id=book_id,
        entity_type="codex",
        entity_id=entity_id,
        content_hash="abc123",
        embedding=vec,
        model_name="text-embedding-3-small",
        dim=len(vec),
    )
    db_session.add(row)
    await db_session.commit()

    loaded = (
        await db_session.execute(
            select(Embedding).where(Embedding.entity_id == entity_id)
        )
    ).scalar_one()
    # The dialect-aware Vector returns a plain list[float] on read (not ndarray).
    assert isinstance(loaded.embedding, list)
    assert loaded.embedding == pytest.approx(vec)
    assert all(isinstance(x, float) for x in loaded.embedding)
    assert loaded.entity_type == "codex"
    assert loaded.model_name == "text-embedding-3-small"
    assert loaded.dim == 4


@pytest.mark.integration
async def test_embedding_unique_entity_constraint(db_session):
    """(entity_type, entity_id) is unique — one current vector per entity."""
    from sqlalchemy.exc import IntegrityError

    book_id = await _make_book(db_session)
    entity_id = uuid.uuid4()
    db_session.add(
        Embedding(
            book_id=book_id,
            entity_type="scene",
            entity_id=entity_id,
            content_hash="h1",
            embedding=[1.0, 2.0],
            model_name="m",
            dim=2,
        )
    )
    await db_session.commit()

    db_session.add(
        Embedding(
            book_id=book_id,
            entity_type="scene",
            entity_id=entity_id,
            content_hash="h2",
            embedding=[3.0, 4.0],
            model_name="m",
            dim=2,
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.commit()
    await db_session.rollback()


@pytest.mark.integration
async def test_embedding_nullable_vector_round_trips_none(db_session):
    book_id = await _make_book(db_session)
    entity_id = uuid.uuid4()
    db_session.add(
        Embedding(
            book_id=book_id,
            entity_type="character",
            entity_id=entity_id,
            content_hash="nohash",
            embedding=None,
            model_name="m",
            dim=1536,
        )
    )
    await db_session.commit()
    loaded = (
        await db_session.execute(
            select(Embedding).where(Embedding.entity_id == entity_id)
        )
    ).scalar_one()
    assert loaded.embedding is None


@pytest.mark.postgres
@pytest.mark.skipif(not IS_POSTGRES, reason="requires real PostgreSQL + pgvector")
async def test_embedding_vector_round_trips_on_postgres(db_session):
    """On real PostgreSQL the column is a true pgvector ``vector(1536)``; a
    round-trip returns the stored vector. Skipped on SQLite."""
    book_id = await _make_book(db_session)
    entity_id = uuid.uuid4()
    vec = [0.01 * i for i in range(1536)]
    db_session.add(
        Embedding(
            book_id=book_id,
            entity_type="worldbuilding",
            entity_id=entity_id,
            content_hash="pg",
            embedding=vec,
            model_name="text-embedding-3-small",
            dim=1536,
        )
    )
    await db_session.commit()
    loaded = (
        await db_session.execute(
            select(Embedding).where(Embedding.entity_id == entity_id)
        )
    ).scalar_one()
    assert isinstance(loaded.embedding, list)
    assert len(loaded.embedding) == 1536
    assert loaded.embedding == pytest.approx(vec, rel=1e-5)
