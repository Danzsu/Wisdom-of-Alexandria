"""Input-length caps on AI text fields (P2 hardening).

``RewriteRequest.selected_text``, ``WriteContinueRequest.scene_text``,
``SummarizeRequest.content`` and each ``GenerateSceneRequest.beats`` item had no
``max_length``, so a pathological payload could balloon a prompt. Generous caps
(big enough for real long-form use) now reject an over-cap payload with 422,
while a normal payload still works.
"""

import uuid

import pytest
from httpx import AsyncClient

# Caps defined in app.api.v1.ai schemas.
from app.api.v1.ai import (
    _BEAT_MAX_CHARS,
    _TEXT_MAX_CHARS,
)

# Reuse the mock AI service fixture from the endpoints test module.
from tests.integration.test_ai_endpoints import mock_ai_svc  # noqa: F401

pytestmark = pytest.mark.integration


async def test_rewrite_over_cap_selected_text_returns_422(
    client: AsyncClient, auth_headers: dict, mock_ai_svc  # noqa: F811
):
    resp = await client.post(
        "/api/v1/ai/rewrite",
        json={"selected_text": "x" * (_TEXT_MAX_CHARS + 1), "instruction": "y"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_rewrite_at_cap_selected_text_ok(
    client: AsyncClient, auth_headers: dict, mock_ai_svc  # noqa: F811
):
    resp = await client.post(
        "/api/v1/ai/rewrite",
        json={"selected_text": "x" * _TEXT_MAX_CHARS, "instruction": "y"},
        headers=auth_headers,
    )
    assert resp.status_code == 200


async def test_describe_over_cap_selected_text_returns_422(
    client: AsyncClient, auth_headers: dict, mock_ai_svc  # noqa: F811
):
    resp = await client.post(
        "/api/v1/ai/describe",
        json={"selected_text": "x" * (_TEXT_MAX_CHARS + 1)},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_describe_normal_selected_text_ok(
    client: AsyncClient, auth_headers: dict, mock_ai_svc  # noqa: F811
):
    resp = await client.post(
        "/api/v1/ai/describe",
        json={"selected_text": "Egy rövid leírandó szöveg."},
        headers=auth_headers,
    )
    assert resp.status_code == 200


async def test_write_continue_over_cap_scene_text_returns_422(
    client: AsyncClient, auth_headers: dict, mock_ai_svc  # noqa: F811
):
    resp = await client.post(
        "/api/v1/ai/write-continue",
        json={"scene_text": "x" * (_TEXT_MAX_CHARS + 1)},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_summarize_over_cap_content_returns_422(
    client: AsyncClient, auth_headers: dict, mock_ai_svc  # noqa: F811
):
    scene_id = str(uuid.uuid4())
    resp = await client.post(
        f"/api/v1/ai/scenes/{scene_id}/summarize",
        json={"content": "x" * (_TEXT_MAX_CHARS + 1)},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_generate_scene_over_cap_beat_returns_422(
    client: AsyncClient, auth_headers: dict, mock_ai_svc  # noqa: F811
):
    resp = await client.post(
        "/api/v1/ai/generate-scene",
        json={"beats": ["ok beat", "x" * (_BEAT_MAX_CHARS + 1)]},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_generate_scene_normal_beats_ok(
    client: AsyncClient, auth_headers: dict, mock_ai_svc  # noqa: F811
):
    resp = await client.post(
        "/api/v1/ai/generate-scene",
        json={"beats": ["Első beat", "Második beat"]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
