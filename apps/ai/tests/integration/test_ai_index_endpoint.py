"""HTTP tests for POST /ai/index + the context_entities response contract (B2b)."""

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from alexandria_core.models.generation_job import GenerationJob, JobStatus
from alexandria_core.models.revision import Revision
from httpx import AsyncClient

from app.api.v1.ai import get_ai_service, get_embedding_service
from app.main import app
from app.services.embedding_service import SyncResult

# ── POST /ai/index ─────────────────────────────────────────────────────────────


def _index_svc(sync_result: SyncResult | None, *, model: str | None) -> AsyncMock:
    svc = AsyncMock()
    svc.resolve_embedding_model.return_value = model
    if sync_result is not None:
        svc.sync_project.return_value = sync_result
    return svc


@pytest.fixture
def mock_embeddings():
    svc = _index_svc(
        SyncResult(indexed=3, updated=1, deleted=2, skipped=4, capped=False),
        model="openai/text-embedding-3-small",
    )
    app.dependency_overrides[get_embedding_service] = lambda: svc
    yield svc
    app.dependency_overrides.pop(get_embedding_service, None)


async def test_index_returns_counts(client: AsyncClient, auth_headers: dict, mock_embeddings):
    project_id = str(uuid.uuid4())
    resp = await client.post(
        f"/api/v1/ai/index?project_id={project_id}", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["indexed"] == 3
    assert data["updated"] == 1
    assert data["deleted"] == 2
    assert data["skipped"] == 4
    assert data["capped"] is False
    assert data["skipped_no_provider"] is False
    mock_embeddings.sync_project.assert_called_once()


async def test_index_accepts_project_id_in_body(
    client: AsyncClient, auth_headers: dict, mock_embeddings
):
    project_id = str(uuid.uuid4())
    resp = await client.post(
        "/api/v1/ai/index", json={"project_id": project_id}, headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["indexed"] == 3


async def test_index_requires_project_id(
    client: AsyncClient, auth_headers: dict, mock_embeddings
):
    resp = await client.post("/api/v1/ai/index", headers=auth_headers)
    assert resp.status_code == 422


async def test_index_requires_auth(client: AsyncClient, mock_embeddings):
    resp = await client.post(
        f"/api/v1/ai/index?project_id={uuid.uuid4()}"
    )
    assert resp.status_code == 401


async def test_index_degrades_when_no_provider(client: AsyncClient, auth_headers: dict):
    """No embedding provider → 200 with zeroed counts + skipped_no_provider."""
    svc = _index_svc(None, model=None)  # resolve_embedding_model → None
    app.dependency_overrides[get_embedding_service] = lambda: svc
    try:
        resp = await client.post(
            f"/api/v1/ai/index?project_id={uuid.uuid4()}", headers=auth_headers
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["skipped_no_provider"] is True
        assert data["indexed"] == 0
        # sync_project must NOT run when RAG is unconfigured.
        svc.sync_project.assert_not_called()
    finally:
        app.dependency_overrides.pop(get_embedding_service, None)


async def test_index_surfaces_dim_mismatch_message(
    client: AsyncClient, auth_headers: dict
):
    """A dimension mismatch must surface a CLEAR, actionable message (naming the
    expected vs actual width + model) on the index response — NOT a generic 502.
    """
    from app.services.embedding_service import EmbeddingDimError

    svc = _index_svc(None, model="ollama/nomic-embed-text")
    svc.sync_project.side_effect = EmbeddingDimError(
        "Embedding model 'ollama/nomic-embed-text' returned 768-dim vectors but "
        "the index expects 1536-dim."
    )
    app.dependency_overrides[get_embedding_service] = lambda: svc
    try:
        resp = await client.post(
            f"/api/v1/ai/index?project_id={uuid.uuid4()}", headers=auth_headers
        )
        assert resp.status_code == 502
        detail = resp.json()["detail"]
        assert "768" in detail
        assert "1536" in detail
        assert "nomic-embed-text" in detail
    finally:
        app.dependency_overrides.pop(get_embedding_service, None)


# ── context_entities in the AI result HTTP contract ────────────────────────────


def _rev() -> Revision:
    r = Revision(
        content="Generated",
        revision_type="rewrite",
        approved=False,
        model_name="ollama/llama3.2",
        prompt_version="1.0",
    )
    r.id = uuid.uuid4()
    r.created_at = datetime.now(UTC)
    r.updated_at = datetime.now(UTC)
    return r


def _job() -> GenerationJob:
    j = GenerationJob(
        job_type="rewrite",
        status=JobStatus.DONE,
        model_name="ollama/llama3.2",
        prompt_version="1.0",
    )
    j.id = uuid.uuid4()
    j.created_at = datetime.now(UTC)
    j.updated_at = datetime.now(UTC)
    return j


@pytest.fixture
def mock_ai_with_context():
    svc = AsyncMock()
    entity = {"id": str(uuid.uuid4()), "label": "Aragorn", "entity_type": "character"}
    svc.rewrite.return_value = (_rev(), _job(), [entity])
    app.dependency_overrides[get_ai_service] = lambda: svc
    yield svc, entity
    app.dependency_overrides.pop(get_ai_service, None)


async def test_rewrite_response_includes_context_entities(
    client: AsyncClient, auth_headers: dict, mock_ai_with_context
):
    _svc, entity = mock_ai_with_context
    resp = await client.post(
        "/api/v1/ai/rewrite",
        json={"selected_text": "x", "instruction": "y", "scene_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "context_entities" in data
    assert data["context_entities"] == [entity]
