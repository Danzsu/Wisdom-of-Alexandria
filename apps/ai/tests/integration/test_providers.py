"""Integration tests for Provider CRUD + test/models endpoints.

Covers the security guarantee: ProviderRead never exposes the plaintext key or
its ciphertext — only a masked value and a has_key flag.
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


# Forbidden keys/values that must NEVER appear in any read response.
PLAINTEXT_KEY = "sk-supersecret-abcdef1234"


async def _create_cloud(client: AsyncClient, auth_headers: dict, **overrides) -> dict:
    body = {
        "type": "openai",
        "label": "My OpenAI",
        "api_key": PLAINTEXT_KEY,
        "base_url": "https://api.openai.com/v1",
        "default_model": "openai/gpt-4o",
    }
    body.update(overrides)
    resp = await client.post(BASE, json=body, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def test_create_provider_returns_masked_only(client: AsyncClient, auth_headers: dict):
    data = await _create_cloud(client, auth_headers)
    assert data["type"] == "openai"
    assert data["label"] == "My OpenAI"
    assert data["has_key"] is True
    assert data["api_key_masked"] == "••••1234"
    assert "id" in data and "created_at" in data and "updated_at" in data


async def test_read_never_contains_plaintext_or_ciphertext(client: AsyncClient, auth_headers: dict):
    created = await _create_cloud(client, auth_headers)
    pid = created["id"]
    resp = await client.get(f"{BASE}/{pid}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    raw = resp.text
    # The plaintext key must never appear anywhere in the serialized response.
    assert PLAINTEXT_KEY not in raw
    # There must be no field exposing the key or ciphertext.
    assert "api_key" not in data
    assert "api_key_encrypted" not in data
    # Only the safe fields exist.
    assert set(data.keys()) == {
        "id",
        "type",
        "label",
        "api_key_masked",
        "has_key",
        "base_url",
        "default_model",
        "enabled",
        "created_at",
        "updated_at",
    }


async def test_ollama_provider_has_no_key(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        BASE,
        json={"type": "ollama", "label": "Local Ollama", "base_url": "http://ollama:11434"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["has_key"] is False
    assert data["api_key_masked"] is None


async def test_create_requires_auth(client: AsyncClient):
    resp = await client.post(BASE, json={"type": "openai", "label": "x"})
    assert resp.status_code == 401


async def test_list_providers(client: AsyncClient, auth_headers: dict):
    await _create_cloud(client, auth_headers, label="A")
    await _create_cloud(client, auth_headers, label="B")
    resp = await client.get(BASE, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    labels = [p["label"] for p in data]
    assert "A" in labels and "B" in labels
    # Even in the list, no plaintext keys leak.
    assert PLAINTEXT_KEY not in resp.text


async def test_list_enabled_only_filter(client: AsyncClient, auth_headers: dict):
    await _create_cloud(client, auth_headers, label="Enabled")
    await _create_cloud(client, auth_headers, label="Disabled", enabled=False)
    resp = await client.get(f"{BASE}?enabled_only=true", headers=auth_headers)
    assert resp.status_code == 200
    labels = [p["label"] for p in resp.json()]
    assert "Enabled" in labels
    assert "Disabled" not in labels


async def test_get_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.get(f"{BASE}/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_update_label_keeps_existing_key(client: AsyncClient, auth_headers: dict):
    created = await _create_cloud(client, auth_headers)
    pid = created["id"]
    resp = await client.patch(f"{BASE}/{pid}", json={"label": "Renamed"}, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["label"] == "Renamed"
    # api_key was not provided -> existing key preserved (still masked).
    assert data["has_key"] is True
    assert data["api_key_masked"] == "••••1234"


async def test_update_with_new_key_reencrypts(client: AsyncClient, auth_headers: dict):
    created = await _create_cloud(client, auth_headers)
    pid = created["id"]
    resp = await client.patch(
        f"{BASE}/{pid}", json={"api_key": "sk-new-key-9999"}, headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_key"] is True
    assert data["api_key_masked"] == "••••9999"
    assert "sk-new-key-9999" not in resp.text


async def test_delete_provider(client: AsyncClient, auth_headers: dict):
    created = await _create_cloud(client, auth_headers)
    pid = created["id"]
    del_resp = await client.delete(f"{BASE}/{pid}", headers=auth_headers)
    assert del_resp.status_code == 204
    get_resp = await client.get(f"{BASE}/{pid}", headers=auth_headers)
    assert get_resp.status_code == 404


async def test_delete_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.delete(f"{BASE}/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


# ── /test endpoint ───────────────────────────────────────────────────────────


async def test_test_ollama_ok(client: AsyncClient, auth_headers: dict):
    created = (
        await client.post(
            BASE,
            json={"type": "ollama", "label": "Local", "base_url": "http://ollama:11434"},
            headers=auth_headers,
        )
    ).json()
    pid = created["id"]

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = False

    with patch("app.services.provider_service.httpx.AsyncClient", return_value=mock_client):
        resp = await client.post(f"{BASE}/{pid}/test", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True


async def test_test_ollama_unreachable_returns_ok_false(client: AsyncClient, auth_headers: dict):
    created = (
        await client.post(
            BASE,
            json={"type": "ollama", "label": "Local", "base_url": "http://ollama:11434"},
            headers=auth_headers,
        )
    ).json()
    pid = created["id"]

    mock_client = AsyncMock()
    mock_client.get.side_effect = Exception("Connection refused")
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = False

    with patch("app.services.provider_service.httpx.AsyncClient", return_value=mock_client):
        resp = await client.post(f"{BASE}/{pid}/test", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert body["detail"]  # non-empty, meaningful detail


async def test_test_cloud_ok_with_decrypted_key(client: AsyncClient, auth_headers: dict):
    created = await _create_cloud(client, auth_headers)
    pid = created["id"]

    captured = {}

    async def _fake_acompletion(**kwargs):
        captured.update(kwargs)
        return MagicMock()

    with patch("litellm.acompletion", new=AsyncMock(side_effect=_fake_acompletion)):
        resp = await client.post(f"{BASE}/{pid}/test", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    # The decrypted key was passed to LiteLLM, never returned to the client.
    assert captured["api_key"] == PLAINTEXT_KEY
    assert PLAINTEXT_KEY not in resp.text


async def test_test_cloud_failure_does_not_leak_key(client: AsyncClient, auth_headers: dict):
    created = await _create_cloud(client, auth_headers)
    pid = created["id"]

    with patch(
        "litellm.acompletion",
        new=AsyncMock(side_effect=Exception("401 Unauthorized")),
    ):
        resp = await client.post(f"{BASE}/{pid}/test", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is False
    assert "401" in body["detail"]
    assert PLAINTEXT_KEY not in resp.text


async def test_test_cloud_without_key_returns_ok_false(client: AsyncClient, auth_headers: dict):
    created = (
        await client.post(BASE, json={"type": "openai", "label": "No key"}, headers=auth_headers)
    ).json()
    pid = created["id"]
    resp = await client.post(f"{BASE}/{pid}/test", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["ok"] is False


async def test_test_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(f"{BASE}/{uuid.uuid4()}/test", headers=auth_headers)
    assert resp.status_code == 404


# ── /models endpoint ─────────────────────────────────────────────────────────


async def test_models_cloud_returns_static_catalog(client: AsyncClient, auth_headers: dict):
    created = await _create_cloud(client, auth_headers, type="anthropic", default_model=None)
    pid = created["id"]
    resp = await client.get(f"{BASE}/{pid}/models", headers=auth_headers)
    assert resp.status_code == 200
    ids = [m["id"] for m in resp.json()["models"]]
    assert any(i.startswith("anthropic/") for i in ids)


async def test_models_ollama_queries_tags(client: AsyncClient, auth_headers: dict):
    created = (
        await client.post(
            BASE,
            json={"type": "ollama", "label": "Local", "base_url": "http://ollama:11434"},
            headers=auth_headers,
        )
    ).json()
    pid = created["id"]

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"models": [{"name": "llama3.2"}, {"name": "mistral"}]}
    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = False

    with patch("app.services.provider_service.httpx.AsyncClient", return_value=mock_client):
        resp = await client.get(f"{BASE}/{pid}/models", headers=auth_headers)
    assert resp.status_code == 200
    ids = [m["id"] for m in resp.json()["models"]]
    assert "ollama/llama3.2" in ids
    assert "ollama/mistral" in ids


async def test_models_requires_auth(client: AsyncClient):
    resp = await client.get(f"{BASE}/{uuid.uuid4()}/models")
    assert resp.status_code == 401


# ── /ai/models aggregation ───────────────────────────────────────────────────


async def test_ai_models_includes_configured_providers(client: AsyncClient, auth_headers: dict):
    await _create_cloud(client, auth_headers, type="anthropic", default_model=None)
    resp = await client.get("/api/v1/ai/models", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    ids = [m["id"] for m in data["models"]]
    # Built-in local default is always present...
    assert data["default"] in ids
    # ...and the configured cloud provider's models are aggregated in.
    assert any(i.startswith("anthropic/") for i in ids)
    cloud = [m for m in data["models"] if m["kind"] == "cloud"]
    assert len(cloud) >= 1


async def test_ai_models_zero_config_still_returns_default(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/ai/models", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    ids = [m["id"] for m in data["models"]]
    assert data["default"] in ids


# ── A6b: ProviderRead serialization never leaks plaintext/ciphertext ─────────
# A focused unit check on the to_read mapper + Pydantic serialization (no HTTP):
# even when fully dumped (model_dump / model_dump_json), a keyed provider only
# exposes api_key_masked + has_key — never the plaintext or the ciphertext.


def test_provider_read_serialization_never_leaks_key():
    from app.core.crypto import encrypt_secret
    from app.services.crud_provider import to_read

    plaintext = "sk-supersecret-abcdef1234"
    ciphertext = encrypt_secret(plaintext)
    provider = Provider(
        type="openai",
        label="Keyed",
        api_key_encrypted=ciphertext,
        enabled=True,
    )
    provider.id = uuid.uuid4()
    from datetime import UTC, datetime

    provider.created_at = datetime.now(UTC)
    provider.updated_at = datetime.now(UTC)

    read = to_read(provider)
    assert read.has_key is True
    assert read.api_key_masked == "••••1234"

    dumped = read.model_dump()
    assert "api_key" not in dumped
    assert "api_key_encrypted" not in dumped

    as_json = read.model_dump_json()
    assert plaintext not in as_json
    assert ciphertext not in as_json
    # Only the masked tail is present.
    assert "1234" in as_json
    assert "supersecret" not in as_json
