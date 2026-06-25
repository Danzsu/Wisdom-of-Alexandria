"""Unit tests for the Ollama model-pull service capability.

``pull_model`` POSTs to ``{base_url}/api/pull`` with ``{"model", "stream": true}``
and yields the parsed NDJSON progress dicts straight from Ollama. We mock the
httpx streaming call — NEVER hit a real Ollama. Covered:

- a valid pull streams the mocked progress lines through to ``{"status":"success"}``
- a non-Ollama provider is rejected (only the endpoint enforces type, but the
  service guards too so a misuse raises rather than POSTs to a cloud endpoint)
- Ollama unreachable / HTTP error surfaces a ``PullModelError`` (clear, bounded)
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from alexandria_core.models.provider import Provider

from app.services.provider_service import PullModelError, pull_model


def _streaming_client(lines: list[str], *, raise_on_request: Exception | None = None):
    """Build a mock httpx.AsyncClient whose ``stream(...)`` yields ``lines``.

    ``client.stream(...)`` is an async context manager returning a response whose
    ``aiter_lines()`` yields the given NDJSON strings. ``raise_for_status`` is a
    no-op unless ``raise_on_request`` is set.
    """

    async def _aiter_lines():
        for line in lines:
            yield line

    resp = MagicMock()
    resp.raise_for_status = MagicMock()
    resp.aiter_lines = _aiter_lines

    stream_cm = AsyncMock()
    stream_cm.__aenter__.return_value = resp
    stream_cm.__aexit__.return_value = False

    client = MagicMock()
    if raise_on_request is not None:
        client.stream = MagicMock(side_effect=raise_on_request)
    else:
        client.stream = MagicMock(return_value=stream_cm)
    client.__aenter__ = AsyncMock(return_value=client)
    client.__aexit__ = AsyncMock(return_value=False)
    return client


@pytest.mark.unit
async def test_pull_model_streams_progress_to_success():
    provider = Provider(type="ollama", label="Local", base_url="http://ollama:11434")
    lines = [
        json.dumps({"status": "pulling manifest"}),
        json.dumps({"status": "downloading", "completed": 50, "total": 100}),
        json.dumps({"status": "success"}),
    ]
    client = _streaming_client(lines)

    with patch("app.services.provider_service.httpx.AsyncClient", return_value=client):
        got = [chunk async for chunk in pull_model(provider, "llama3.1:8b")]

    assert got[0]["status"] == "pulling manifest"
    assert got[1] == {"status": "downloading", "completed": 50, "total": 100}
    assert got[-1]["status"] == "success"

    # The POST body targeted /api/pull with stream=true and the model name.
    _, kwargs = client.stream.call_args
    assert client.stream.call_args[0][0] == "POST"
    assert client.stream.call_args[0][1].endswith("/api/pull")
    assert kwargs["json"] == {"model": "llama3.1:8b", "stream": True}


@pytest.mark.unit
async def test_pull_model_rejects_non_ollama_provider():
    provider = Provider(type="openai", label="Cloud")
    with pytest.raises(PullModelError):
        # The generator must raise on first iteration (no POST to a cloud endpoint).
        async for _ in pull_model(provider, "gpt-4o"):
            pass


@pytest.mark.unit
async def test_pull_model_unreachable_raises_pull_error():
    provider = Provider(type="ollama", label="Local", base_url="http://ollama:11434")
    client = _streaming_client([], raise_on_request=httpx.ConnectError("refused"))

    with patch("app.services.provider_service.httpx.AsyncClient", return_value=client):
        with pytest.raises(PullModelError):
            async for _ in pull_model(provider, "llama3.1:8b"):
                pass


@pytest.mark.unit
async def test_pull_model_skips_blank_and_unparsable_lines():
    """NDJSON keep-alives / blank lines must not crash the stream."""
    provider = Provider(type="ollama", label="Local", base_url="http://ollama:11434")
    lines = ["", "   ", "not-json", json.dumps({"status": "success"})]
    client = _streaming_client(lines)

    with patch("app.services.provider_service.httpx.AsyncClient", return_value=client):
        got = [chunk async for chunk in pull_model(provider, "llama3.1:8b")]

    # Only the valid JSON line survives.
    assert got == [{"status": "success"}]
