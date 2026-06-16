import uuid
from datetime import UTC
from unittest.mock import AsyncMock

import pytest
from alexandria_core.models.generation_job import GenerationJob, JobStatus
from alexandria_core.models.revision import Revision
from httpx import AsyncClient

from app.api.v1.ai import get_ai_service
from app.main import app


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
    from datetime import datetime
    rev.created_at = datetime.now(UTC)
    rev.updated_at = datetime.now(UTC)
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
    from datetime import datetime
    job.created_at = datetime.now(UTC)
    job.updated_at = datetime.now(UTC)
    return job


def _make_ai_service_mock():
    svc = AsyncMock()
    rev = _mock_revision()
    job = _mock_job()
    # rewrite / write_continue / generate_scene return a 3-tuple including
    # context_entities (B2b RAG). describe / summarize stay 2-tuples.
    svc.rewrite.return_value = (rev, job, [])
    svc.describe.return_value = ([_mock_revision(revision_type="describe_channel") for _ in range(6)], job)
    svc.write_continue.return_value = (rev, job, [])
    svc.generate_scene.return_value = (rev, job, [])
    svc.summarize.return_value = (rev, job)
    # check_continuity returns (warnings, job, context_entities) — NO revision.
    svc.check_continuity.return_value = (
        [
            {"severity": "warning", "message": "Folytonossági eltérés.", "entity": "Szelene"},
        ],
        _mock_job(job_type="continuity"),
        [],
    )
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


async def test_rewrite_ai_error_detail_is_sanitized(client: AsyncClient, auth_headers: dict, mock_ai_svc):
    """FIX 1: the 502 detail must be bounded, single-line, generic-prefixed."""
    raw = "Traceback (most recent call last):\n  File ...\n" + ("z" * 5000)
    mock_ai_svc.rewrite.side_effect = Exception(raw)
    resp = await client.post(
        "/api/v1/ai/rewrite",
        json={"selected_text": "x", "instruction": "y"},
        headers=auth_headers,
    )
    assert resp.status_code == 502
    detail = resp.json()["detail"]
    assert detail.startswith("AI generation failed: ")
    assert "\n" not in detail
    # generic prefix (23 chars) + bounded body (<= 300).
    assert len(detail) <= len("AI generation failed: ") + 300
    # The old leaky format must be gone.
    assert not detail.startswith("AI error:")


async def test_all_ai_endpoints_sanitize_error_detail(client: AsyncClient, auth_headers: dict, mock_ai_svc):
    """Every AI handler uses the sanitized prefix, never the old raw format."""
    scene_id = str(uuid.uuid4())
    chapter_id = str(uuid.uuid4())
    mock_ai_svc.rewrite.side_effect = Exception("boom\nleak")
    mock_ai_svc.describe.side_effect = Exception("boom\nleak")
    mock_ai_svc.write_continue.side_effect = Exception("boom\nleak")
    mock_ai_svc.generate_scene.side_effect = Exception("boom\nleak")
    mock_ai_svc.summarize.side_effect = Exception("boom\nleak")
    endpoints = [
        ("/api/v1/ai/rewrite", {"selected_text": "x", "instruction": "y"}),
        ("/api/v1/ai/describe", {"selected_text": "x"}),
        ("/api/v1/ai/write-continue", {"scene_text": "x"}),
        ("/api/v1/ai/generate-scene", {"beats": ["x"]}),
        (f"/api/v1/ai/scenes/{scene_id}/summarize", {"content": "x"}),
        (f"/api/v1/ai/chapters/{chapter_id}/summarize", {"content": "x"}),
    ]
    for url, body in endpoints:
        resp = await client.post(url, json=body, headers=auth_headers)
        assert resp.status_code == 502, url
        detail = resp.json()["detail"]
        assert detail.startswith("AI generation failed: "), url
        assert "\n" not in detail, url


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
    """FIX 2: invalid channels validated in ONE place (AIService.describe).

    The mock AIService is replaced here with one whose describe raises the same
    ValueError the real service raises, so we exercise the endpoint's single
    sanitized 422 path (not a separate endpoint-level pre-check)."""
    mock_ai_svc.describe.side_effect = ValueError(
        "Invalid channels: ['NemLétezo']. Valid: ['Látás', 'Hang', 'Tapintás', 'Szag', 'Íz', 'Metaforák']"
    )
    resp = await client.post(
        "/api/v1/ai/describe",
        json={"selected_text": "x", "channels": ["NemLétezo"]},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    detail = resp.json()["detail"]
    # Sanitized (single line) and lists valid channels for the caller.
    assert "\n" not in detail
    assert "Invalid channels" in detail
    assert "Látás" in detail


async def test_describe_valid_channels_still_work(client: AsyncClient, auth_headers: dict, mock_ai_svc):
    """FIX 2: valid channels still pass through to a 200 with revisions."""
    resp = await client.post(
        "/api/v1/ai/describe",
        json={"selected_text": "x", "channels": ["Látás", "Hang"]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert "revisions" in resp.json()
    mock_ai_svc.describe.assert_called_once()


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
        ("POST", "/api/v1/ai/continuity", {"scene_id": scene_id}),
    ]
    for method, url, body in endpoints:
        resp = await client.request(method, url, json=body)
        assert resp.status_code == 401, f"{method} {url} should 401 without auth"


# ── Continuity check (B3) ──────────────────────────────────────────────────────


async def test_continuity_returns_structured_warnings(
    client: AsyncClient, auth_headers: dict, mock_ai_svc
):
    scene_id = str(uuid.uuid4())
    resp = await client.post(
        "/api/v1/ai/continuity",
        json={"scene_id": scene_id},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "warnings" in data
    assert "context_entities" in data
    assert len(data["warnings"]) == 1
    w = data["warnings"][0]
    assert w["severity"] == "warning"
    assert w["message"] == "Folytonossági eltérés."
    assert w["entity"] == "Szelene"
    # NO revision in the continuity contract (analysis, not generated content).
    assert "revision" not in data
    mock_ai_svc.check_continuity.assert_called_once()
    assert mock_ai_svc.check_continuity.call_args.kwargs["scene_id"] == uuid.UUID(scene_id)


async def test_continuity_empty_no_issues(
    client: AsyncClient, auth_headers: dict, mock_ai_svc
):
    mock_ai_svc.check_continuity.return_value = ([], _mock_job("continuity"), [])
    resp = await client.post(
        "/api/v1/ai/continuity",
        json={"scene_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["warnings"] == []


async def test_continuity_requires_auth(client: AsyncClient, mock_ai_svc):
    resp = await client.post(
        "/api/v1/ai/continuity", json={"scene_id": str(uuid.uuid4())}
    )
    assert resp.status_code == 401


async def test_continuity_requires_scene_id(
    client: AsyncClient, auth_headers: dict, mock_ai_svc
):
    resp = await client.post("/api/v1/ai/continuity", json={}, headers=auth_headers)
    assert resp.status_code == 422


async def test_continuity_ai_error_returns_502_sanitized(
    client: AsyncClient, auth_headers: dict, mock_ai_svc
):
    raw = "Traceback (most recent call last):\n  File ...\n" + ("z" * 5000)
    mock_ai_svc.check_continuity.side_effect = Exception(raw)
    resp = await client.post(
        "/api/v1/ai/continuity",
        json={"scene_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    assert resp.status_code == 502
    detail = resp.json()["detail"]
    assert detail.startswith("AI generation failed: ")
    assert "\n" not in detail
    assert len(detail) <= len("AI generation failed: ") + 300


async def test_continuity_forwards_model(
    client: AsyncClient, auth_headers: dict, mock_ai_svc
):
    resp = await client.post(
        "/api/v1/ai/continuity",
        json={"scene_id": str(uuid.uuid4()), "model": "ollama/llama3.2"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert mock_ai_svc.check_continuity.call_args.kwargs["model"] == "ollama/llama3.2"
