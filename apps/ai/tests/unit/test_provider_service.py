"""A3 regression: the Ollama model-fetch failure path must log a warning and
return ``[]`` — it must not be silent. The empty-list return contract is kept
(an unreachable Ollama legitimately has "no models"), but a failure is now
diagnosable instead of being swallowed.
"""

import logging
from unittest.mock import AsyncMock, patch

import pytest
from alexandria_core.models.provider import Provider

from app.services.provider_service import list_provider_models


@pytest.mark.unit
async def test_ollama_models_failure_logs_warning_and_returns_empty(caplog):
    provider = Provider(type="ollama", label="Local", base_url="http://ollama:11434")

    # _ollama_models opens an httpx client and calls .get; force it to raise.
    mock_client = AsyncMock()
    mock_client.get.side_effect = Exception("Connection refused")
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = False

    with caplog.at_level(logging.WARNING, logger="app.services.provider_service"):
        with patch(
            "app.services.provider_service.httpx.AsyncClient", return_value=mock_client
        ):
            result = await list_provider_models(provider)

    # Contract preserved: empty list, no exception.
    assert result == []
    # ...but the failure is now logged (not silent).
    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert warnings, "expected a WARNING log on Ollama fetch failure"
    msg = warnings[0].getMessage()
    assert "Failed to fetch Ollama models" in msg
    assert "http://ollama:11434" in msg
    assert "Connection refused" in msg


@pytest.mark.unit
async def test_ollama_models_success_does_not_log_warning(caplog):
    from unittest.mock import MagicMock

    provider = Provider(type="ollama", label="Local", base_url="http://ollama:11434")

    mock_resp = MagicMock()
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"models": [{"name": "llama3.2"}]}
    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp
    mock_client.__aenter__.return_value = mock_client
    mock_client.__aexit__.return_value = False

    with caplog.at_level(logging.WARNING, logger="app.services.provider_service"):
        with patch(
            "app.services.provider_service.httpx.AsyncClient", return_value=mock_client
        ):
            result = await list_provider_models(provider)

    assert [m.id for m in result] == ["ollama/llama3.2"]
    assert not [r for r in caplog.records if r.levelno == logging.WARNING]
