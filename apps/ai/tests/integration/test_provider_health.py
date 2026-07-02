"""GET /providers/{id}/health — lightweight Ollama liveness ping.

Mocked httpx only (no live Ollama): reachable → 200 with the live model count;
unreachable → 503 with an actionable message; non-Ollama providers → 400; auth
consistent with the sibling provider GETs.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from alexandria_core.models.provider import Provider
from httpx import AsyncClient
from sqlalchemy import delete

BASE = "/api/v1/providers"


@pytest.fixture(autouse=True)
async def _clean_providers(db_session):
    """Providers are global (non-project-scoped) and CRUD commits persist on the
    shared test engine. Clear the table around each test for isolation."""
    await db_session.execute(delete(Provider))
    await db_session.commit()
    yield
    await db_session.execute(delete(Provider))
    await db_session.commit()


async def _create_ollama(client: AsyncClient, auth_headers: dict) -> str:
    resp = await client.post(
        BASE,
        json={"type": "ollama", "label": "Local", "base_url": "http://ollama:11434"},
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def _mock_http_client(get_result=None, get_side_effect=None):
    mock_client = AsyncMock()
    if get_result is not None:
        mock_client.get.return_value = get_result
    if get_side_effect is not None:
        mock_client.get.side_effect = get_side_effect
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = False
    return mock_client


async def test_health_ollama_reachable_returns_ok_and_model_count(
    client: AsyncClient, auth_headers: dict
):
    pid = await _create_ollama(client, auth_headers)

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "models": [{"name": "llama3.2"}, {"name": "mistral"}]
    }
    mock_client = _mock_http_client(get_result=mock_resp)

    with patch(
        "app.services.provider_service.httpx.AsyncClient", return_value=mock_client
    ) as mock_ctor:
        resp = await client.get(f"{BASE}/{pid}/health", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"status": "ok", "model_count": 2}
    # The ping hits /api/tags on the provider's base_url.
    called_url = mock_client.get.call_args.args[0]
    assert called_url == "http://ollama:11434/api/tags"
    # SHORT timeout — a health ping must fail fast, not hang for the default 10s.
    timeout = mock_ctor.call_args.kwargs["timeout"]
    assert float(timeout) <= 5.0


async def test_health_ollama_unreachable_returns_503(
    client: AsyncClient, auth_headers: dict
):
    pid = await _create_ollama(client, auth_headers)

    mock_client = _mock_http_client(get_side_effect=Exception("Connection refused"))
    with patch(
        "app.services.provider_service.httpx.AsyncClient", return_value=mock_client
    ):
        resp = await client.get(f"{BASE}/{pid}/health", headers=auth_headers)
    assert resp.status_code == 503
    assert resp.json()["detail"]  # non-empty, actionable message


async def test_health_non_ollama_provider_returns_400(
    client: AsyncClient, auth_headers: dict
):
    created = await client.post(
        BASE,
        json={"type": "openai", "label": "Cloud", "api_key": "sk-test-1234"},
        headers=auth_headers,
    )
    pid = created.json()["id"]
    resp = await client.get(f"{BASE}/{pid}/health", headers=auth_headers)
    assert resp.status_code == 400


async def test_health_provider_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.get(f"{BASE}/{uuid.uuid4()}/health", headers=auth_headers)
    assert resp.status_code == 404


async def test_health_requires_auth(client: AsyncClient):
    resp = await client.get(f"{BASE}/{uuid.uuid4()}/health")
    assert resp.status_code == 401
