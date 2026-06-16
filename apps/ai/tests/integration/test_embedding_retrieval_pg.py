"""EmbeddingService.retrieve — cosine ordering + query-time ai_visible filter.

These exercise the real ``cosine_distance`` (``<=>``) operator, which is
PostgreSQL/pgvector only, so they are ``@pytest.mark.postgres`` and skipped on
the default SQLite test DB. They seed embedding rows with KNOWN vectors and a
KNOWN query vector (via a mocked ``embed`` so the maths is deterministic) and
assert the nearest entity comes back first.
"""

import uuid
from unittest.mock import AsyncMock

import pytest
from alexandria_core.models.codex_entry import CodexEntry
from alexandria_core.models.embedding import Embedding
from alexandria_core.models.project import Project
from alexandria_core.models.series import Series

from app.services.embedding_service import EmbeddingService
from app.services.model_router import ModelRouter
from tests.conftest import IS_POSTGRES

pytestmark = [
    pytest.mark.postgres,
    pytest.mark.skipif(not IS_POSTGRES, reason="requires real PostgreSQL + pgvector"),
]

EMBED_MODEL = "openai/text-embedding-3-small"
DIM = 1536


def _vec(*, lead: float) -> list[float]:
    """A 1536-d vector whose first component is ``lead`` and rest are 0."""
    v = [0.0] * DIM
    v[0] = lead
    return v


def _query_router(query_vec: list[float]) -> ModelRouter:
    router = AsyncMock(spec=ModelRouter)
    router.embed.return_value = [query_vec]
    return router


async def _make_project(db) -> uuid.UUID:
    project = Project(title="PG RAG")
    db.add(project)
    await db.flush()
    await db.commit()
    return project.id


async def _seed_codex_embedding(
    db, project_id: uuid.UUID, *, title: str, lead: float
) -> uuid.UUID:
    entry = CodexEntry(project_id=project_id, title=title, content=title, ai_visible=True)
    db.add(entry)
    await db.flush()
    db.add(
        Embedding(
            project_id=project_id,
            entity_type="codex",
            entity_id=entry.id,
            content_hash=f"h-{title}",
            embedding=_vec(lead=lead),
            model_name=EMBED_MODEL,
            dim=DIM,
        )
    )
    await db.commit()
    return entry.id


async def test_retrieve_orders_by_cosine_similarity(db_session):
    """The entity whose vector points the same way as the query ranks first."""
    project_id = await _make_project(db_session)
    # "near" points the SAME direction as the query ([+1, 0, …]); "far" points
    # the OPPOSITE way ([-1, 0, …]) → larger cosine distance.
    near_id = await _seed_codex_embedding(db_session, project_id, title="Közeli", lead=1.0)
    await _seed_codex_embedding(db_session, project_id, title="Távoli", lead=-1.0)

    svc = EmbeddingService(router=_query_router(_vec(lead=1.0)))
    results = await svc.retrieve(
        db_session, project_id, "lekérdezés", embedding_model=EMBED_MODEL, k=5
    )

    assert len(results) == 2
    assert results[0].entity_id == near_id  # most similar first
    assert results[0].distance <= results[1].distance


async def test_retrieve_filters_ai_invisible_at_query_time(db_session):
    """A row hidden AFTER indexing must not leak into retrieval results."""
    project_id = await _make_project(db_session)
    visible_id = await _seed_codex_embedding(
        db_session, project_id, title="Látható", lead=1.0
    )
    hidden_id = await _seed_codex_embedding(
        db_session, project_id, title="Rejtett", lead=0.9
    )
    # Hide the second entry's source row (embedding row remains until next sync).
    hidden = await db_session.get(CodexEntry, hidden_id)
    hidden.ai_visible = False
    await db_session.commit()

    svc = EmbeddingService(router=_query_router(_vec(lead=1.0)))
    results = await svc.retrieve(
        db_session, project_id, "lekérdezés", embedding_model=EMBED_MODEL, k=5
    )

    returned_ids = {r.entity_id for r in results}
    assert visible_id in returned_ids
    assert hidden_id not in returned_ids  # defensively filtered


async def test_retrieve_respects_project_scope(db_session):
    """Retrieval never returns another project's embeddings."""
    p1 = await _make_project(db_session)
    p2 = await _make_project(db_session)
    p1_id = await _seed_codex_embedding(db_session, p1, title="P1", lead=1.0)
    await _seed_codex_embedding(db_session, p2, title="P2", lead=1.0)

    svc = EmbeddingService(router=_query_router(_vec(lead=1.0)))
    results = await svc.retrieve(db_session, p1, "q", embedding_model=EMBED_MODEL, k=5)

    assert {r.entity_id for r in results} == {p1_id}


# ── series scope on retrieve (B3b) ─────────────────────────────────────────────


async def _make_series(db, project_id: uuid.UUID, title: str) -> uuid.UUID:
    series = Series(project_id=project_id, title=title)
    db.add(series)
    await db.flush()
    await db.commit()
    return series.id


async def _seed_codex_embedding_series(
    db, project_id: uuid.UUID, *, title: str, lead: float, series_id: uuid.UUID | None
) -> uuid.UUID:
    entry = CodexEntry(
        project_id=project_id,
        series_id=series_id,
        title=title,
        content=title,
        ai_visible=True,
    )
    db.add(entry)
    await db.flush()
    db.add(
        Embedding(
            project_id=project_id,
            series_id=series_id,
            entity_type="codex",
            entity_id=entry.id,
            content_hash=f"h-{title}",
            embedding=_vec(lead=lead),
            model_name=EMBED_MODEL,
            dim=DIM,
        )
    )
    await db.commit()
    return entry.id


async def test_retrieve_active_series_includes_global_and_series_excludes_other(
    db_session,
):
    """active_series_id=A → returns project-global (NULL) + series-A; EXCLUDES
    series-B."""
    project_id = await _make_project(db_session)
    series_a = await _make_series(db_session, project_id, "A")
    series_b = await _make_series(db_session, project_id, "B")

    global_id = await _seed_codex_embedding_series(
        db_session, project_id, title="Globalis", lead=1.0, series_id=None
    )
    a_id = await _seed_codex_embedding_series(
        db_session, project_id, title="A-kodex", lead=1.0, series_id=series_a
    )
    b_id = await _seed_codex_embedding_series(
        db_session, project_id, title="B-kodex", lead=1.0, series_id=series_b
    )

    svc = EmbeddingService(router=_query_router(_vec(lead=1.0)))
    results = await svc.retrieve(
        db_session,
        project_id,
        "q",
        embedding_model=EMBED_MODEL,
        k=10,
        active_series_id=series_a,
    )

    ids = {r.entity_id for r in results}
    assert global_id in ids
    assert a_id in ids
    assert b_id not in ids  # other series excluded


async def test_retrieve_no_active_series_returns_only_global(db_session):
    """active_series_id=None (book not in a series) → only project-global rows."""
    project_id = await _make_project(db_session)
    series_a = await _make_series(db_session, project_id, "A")

    global_id = await _seed_codex_embedding_series(
        db_session, project_id, title="Globalis", lead=1.0, series_id=None
    )
    a_id = await _seed_codex_embedding_series(
        db_session, project_id, title="A-kodex", lead=1.0, series_id=series_a
    )

    svc = EmbeddingService(router=_query_router(_vec(lead=1.0)))
    results = await svc.retrieve(
        db_session,
        project_id,
        "q",
        embedding_model=EMBED_MODEL,
        k=10,
        active_series_id=None,
    )

    ids = {r.entity_id for r in results}
    assert ids == {global_id}
    assert a_id not in ids
