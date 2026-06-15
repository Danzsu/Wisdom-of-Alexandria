import uuid
import pytest
from unittest.mock import AsyncMock
from httpx import AsyncClient

from app.main import app
from app.api.v1.ai import get_ai_service
from app.models.revision import Revision
from app.models.generation_job import GenerationJob, JobStatus


def _mock_revision(scene_id=None, revision_type="rewrite", content="Generated"):
    rev = Revision(
        content=content,
        revision_type=revision_type,
        approved=False,
        scene_id=scene_id,
        model_name="ollama/llama3.2",
        prompt_version="1.0",
    )
    import uuid as _uuid
    rev.id = _uuid.uuid4()
    from datetime import datetime, timezone
    rev.created_at = datetime.now(timezone.utc)
    rev.updated_at = datetime.now(timezone.utc)
    return rev


def _mock_job(job_type="rewrite"):
    job = GenerationJob(
        job_type=job_type,
        status=JobStatus.DONE,
        model_name="ollama/llama3.2",
        prompt_version="1.0",
    )
    import uuid as _uuid
    job.id = _uuid.uuid4()
    from datetime import datetime, timezone
    job.created_at = datetime.now(timezone.utc)
    job.updated_at = datetime.now(timezone.utc)
    return job


def _make_ai_service_mock():
    svc = AsyncMock()
    rev = _mock_revision()
    job = _mock_job()
    svc.rewrite.return_value = (rev, job)
    svc.describe.return_value = ([_mock_revision(revision_type="describe_channel") for _ in range(6)], job)
    svc.write_continue.return_value = (rev, job)
    svc.generate_scene.return_value = (rev, job)
    svc.summarize.return_value = (rev, job)
    return svc


@pytest.fixture(autouse=False)
def mock_ai_svc():
    mock_svc = _make_ai_service_mock()
    app.dependency_overrides[get_ai_service] = lambda: mock_svc
    yield mock_svc
    app.dependency_overrides.pop(get_ai_service, None)


async def test_rewrite_returns_revision(client: AsyncClient, auth_headers: dict, mock_ai_svc):
    resp = await client.post(
        "/api/v1/ai/rewrite",
        json={"selected_text": "Eredeti szöveg", "instruction": "Javítsd"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "revision" in data
    assert "job" in data
    assert data["revision"]["approved"] is False
    mock_ai_svc.rewrite.assert_called_once()


async def test_rewrite_requires_auth(client: AsyncClient, mock_ai_svc):
    resp = await client.post("/api/v1/ai/rewrite", json={"selected_text": "x", "instruction": "y"})
    assert resp.status_code == 401


async def test_rewrite_ai_error_returns_502(client: AsyncClient, auth_headers: dict, mock_ai_svc):
    mock_ai_svc.rewrite.side_effect = Exception("LLM unreachable")
    resp = await client.post(
        "/api/v1/ai/rewrite",
        json={"selected_text": "x", "instruction": "y"},
        headers=auth_headers,
    )
    assert resp.status_code == 502


async def test_describe_returns_6_revisions_by_default(client: AsyncClient, auth_headers: dict, mock_ai_svc):
    resp = await client.post(
        "/api/v1/ai/describe",
        json={"selected_text": "Egy szoba leírása"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["revisions"]) == 6


async def test_describe_invalid_channel_returns_422(client: AsyncClient, auth_headers: dict, mock_ai_svc):
    resp = await client.post(
        "/api/v1/ai/describe",
        json={"selected_text": "x", "channels": ["NemLétezo"]},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_describe_requires_auth(client: AsyncClient, mock_ai_svc):
    resp = await client.post("/api/v1/ai/describe", json={"selected_text": "x"})
    assert resp.status_code == 401


async def test_write_continue_returns_revision(client: AsyncClient, auth_headers: dict, mock_ai_svc):
    resp = await client.post(
        "/api/v1/ai/write-continue",
        json={"scene_text": "A hős belépett a szobába."},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert "revision" in resp.json()
    mock_ai_svc.write_continue.assert_called_once()


async def test_generate_scene_returns_revision(client: AsyncClient, auth_headers: dict, mock_ai_svc):
    resp = await client.post(
        "/api/v1/ai/generate-scene",
        json={"beats": ["A hős belép", "Találkozás az ellenféllel"]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    mock_ai_svc.generate_scene.assert_called_once()


async def test_generate_scene_empty_beats_returns_422(client: AsyncClient, auth_headers: dict, mock_ai_svc):
    resp = await client.post(
        "/api/v1/ai/generate-scene",
        json={"beats": []},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_summarize_scene_returns_revision(client: AsyncClient, auth_headers: dict, mock_ai_svc):
    scene_id = str(uuid.uuid4())
    resp = await client.post(
        f"/api/v1/ai/scenes/{scene_id}/summarize",
        json={"content": "A jelenet szövege..."},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    mock_ai_svc.summarize.assert_called_once()


async def test_summarize_chapter_returns_revision(client: AsyncClient, auth_headers: dict, mock_ai_svc):
    chapter_id = str(uuid.uuid4())
    resp = await client.post(
        f"/api/v1/ai/chapters/{chapter_id}/summarize",
        json={"content": "A fejezet szövege..."},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    mock_ai_svc.summarize.assert_called_once()


# ── Generation parameters (P1.2) ───────────────────────────────────────────────


async def test_rewrite_forwards_generation_params(
    client: AsyncClient, auth_headers: dict, mock_ai_svc
):
    resp = await client.post(
        "/api/v1/ai/rewrite",
        json={"selected_text": "x", "instruction": "y", "temperature": 0.3, "max_tokens": 256},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    kwargs = mock_ai_svc.rewrite.call_args.kwargs
    assert kwargs["temperature"] == 0.3
    assert kwargs["max_tokens"] == 256


async def test_rewrite_omits_generation_params(
    client: AsyncClient, auth_headers: dict, mock_ai_svc
):
    resp = await client.post(
        "/api/v1/ai/rewrite",
        json={"selected_text": "x", "instruction": "y"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    kwargs = mock_ai_svc.rewrite.call_args.kwargs
    # Optional + backward compatible: defaults to None, AIService keeps per-action default.
    assert kwargs["temperature"] is None
    assert kwargs["max_tokens"] is None


async def test_generate_scene_forwards_generation_params(
    client: AsyncClient, auth_headers: dict, mock_ai_svc
):
    resp = await client.post(
        "/api/v1/ai/generate-scene",
        json={"beats": ["a"], "temperature": 1.2, "max_tokens": 8000},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    kwargs = mock_ai_svc.generate_scene.call_args.kwargs
    assert kwargs["temperature"] == 1.2
    assert kwargs["max_tokens"] == 8000


async def test_summarize_forwards_generation_params(
    client: AsyncClient, auth_headers: dict, mock_ai_svc
):
    scene_id = str(uuid.uuid4())
    resp = await client.post(
        f"/api/v1/ai/scenes/{scene_id}/summarize",
        json={"content": "x", "temperature": 0.0, "max_tokens": 600},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    kwargs = mock_ai_svc.summarize.call_args.kwargs
    assert kwargs["temperature"] == 0.0
    assert kwargs["max_tokens"] == 600


@pytest.mark.parametrize("temperature", [-0.1, 2.1])
async def test_rewrite_rejects_out_of_range_temperature(
    client: AsyncClient, auth_headers: dict, mock_ai_svc, temperature: float
):
    resp = await client.post(
        "/api/v1/ai/rewrite",
        json={"selected_text": "x", "instruction": "y", "temperature": temperature},
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.parametrize("max_tokens", [0, -5, 40000])
async def test_rewrite_rejects_out_of_range_max_tokens(
    client: AsyncClient, auth_headers: dict, mock_ai_svc, max_tokens: int
):
    resp = await client.post(
        "/api/v1/ai/rewrite",
        json={"selected_text": "x", "instruction": "y", "max_tokens": max_tokens},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_generate_scene_rejects_out_of_range_max_tokens(
    client: AsyncClient, auth_headers: dict, mock_ai_svc
):
    resp = await client.post(
        "/api/v1/ai/generate-scene",
        json={"beats": ["a"], "max_tokens": 32769},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_all_ai_endpoints_require_auth(client: AsyncClient, mock_ai_svc):
    scene_id = str(uuid.uuid4())
    chapter_id = str(uuid.uuid4())
    endpoints = [
        ("POST", "/api/v1/ai/rewrite", {"selected_text": "x", "instruction": "y"}),
        ("POST", "/api/v1/ai/describe", {"selected_text": "x"}),
        ("POST", "/api/v1/ai/write-continue", {"scene_text": "x"}),
        ("POST", "/api/v1/ai/generate-scene", {"beats": ["x"]}),
        ("POST", f"/api/v1/ai/scenes/{scene_id}/summarize", {"content": "x"}),
        ("POST", f"/api/v1/ai/chapters/{chapter_id}/summarize", {"content": "x"}),
    ]
    for method, url, body in endpoints:
        resp = await client.request(method, url, json=body)
        assert resp.status_code == 401, f"{method} {url} should 401 without auth"
