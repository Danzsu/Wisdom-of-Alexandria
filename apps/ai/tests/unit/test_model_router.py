import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.model_router import ModelResponse, ModelRouter, _pick_provider


def _mock_response(content: str, model: str = "ollama/llama3.2"):
    resp = MagicMock()
    resp.choices = [MagicMock()]
    resp.choices[0].message.content = content
    resp.usage.prompt_tokens = 10
    resp.usage.completion_tokens = 20
    resp.usage.total_tokens = 30
    return resp


@pytest.mark.unit
async def test_complete_returns_model_response():
    router = ModelRouter(base_url="http://localhost:11434", default_model="ollama/llama3.2")
    mock_resp = _mock_response("Egy szép nap volt.")
    with patch("app.services.model_router.acompletion", new=AsyncMock(return_value=mock_resp)):
        result = await router.complete(
            messages=[{"role": "user", "content": "Írj egy mondatot!"}]
        )
    assert isinstance(result, ModelResponse)
    assert result.content == "Egy szép nap volt."
    assert result.model == "ollama/llama3.2"
    assert result.usage["total_tokens"] == 30


@pytest.mark.unit
async def test_complete_uses_specified_model():
    router = ModelRouter(base_url="http://localhost:11434", default_model="ollama/llama3.2")
    mock_resp = _mock_response("content", model="ollama/mistral")
    with patch("app.services.model_router.acompletion", new=AsyncMock(return_value=mock_resp)) as mock_call:
        await router.complete(
            messages=[{"role": "user", "content": "test"}],
            model="ollama/mistral",
        )
    call_kwargs = mock_call.call_args
    assert call_kwargs.kwargs["model"] == "ollama/mistral"


@pytest.mark.unit
async def test_complete_uses_default_model_when_none_specified():
    router = ModelRouter(base_url="http://localhost:11434", default_model="ollama/llama3.2")
    mock_resp = _mock_response("response")
    with patch("app.services.model_router.acompletion", new=AsyncMock(return_value=mock_resp)) as mock_call:
        await router.complete(messages=[{"role": "user", "content": "test"}])
    assert mock_call.call_args.kwargs["model"] == "ollama/llama3.2"


@pytest.mark.unit
async def test_complete_sets_api_base_for_ollama_model():
    router = ModelRouter(base_url="http://ollama:11434", default_model="ollama/llama3.2")
    mock_resp = _mock_response("content")
    with patch("app.services.model_router.acompletion", new=AsyncMock(return_value=mock_resp)) as mock_call:
        await router.complete(messages=[{"role": "user", "content": "test"}])
    assert mock_call.call_args.kwargs["api_base"] == "http://ollama:11434"


@pytest.mark.unit
async def test_complete_no_api_base_for_non_ollama_model():
    router = ModelRouter(base_url="http://ollama:11434", default_model="gemini/gemini-pro")
    mock_resp = _mock_response("content")
    with patch("app.services.model_router.acompletion", new=AsyncMock(return_value=mock_resp)) as mock_call:
        await router.complete(messages=[{"role": "user", "content": "test"}])
    assert mock_call.call_args.kwargs["api_base"] is None


@pytest.mark.unit
async def test_build_messages_returns_system_and_user():
    router = ModelRouter()
    msgs = router.build_messages(system="Te egy regényíró asszisztens vagy.", user="Írj egy jelenetet.")
    assert len(msgs) == 2
    assert msgs[0]["role"] == "system"
    assert msgs[0]["content"] == "Te egy regényíró asszisztens vagy."
    assert msgs[1]["role"] == "user"
    assert msgs[1]["content"] == "Írj egy jelenetet."


@pytest.mark.unit
async def test_complete_handles_empty_content():
    router = ModelRouter()
    mock_resp = _mock_response("")
    mock_resp.choices[0].message.content = None
    with patch("app.services.model_router.acompletion", new=AsyncMock(return_value=mock_resp)):
        result = await router.complete(messages=[{"role": "user", "content": "test"}])
    assert result.content == ""


@pytest.mark.unit
async def test_module_level_singleton_exists():
    from app.services.model_router import model_router
    assert isinstance(model_router, ModelRouter)


# ── Timeout (FIX 3) ─────────────────────────────────────────────────────────


@pytest.mark.unit
async def test_complete_passes_timeout_to_acompletion():
    from alexandria_core.core.config import settings

    router = ModelRouter(base_url="http://ollama:11434", default_model="ollama/llama3.2")
    mock_resp = _mock_response("ok")
    with patch("app.services.model_router.acompletion", new=AsyncMock(return_value=mock_resp)) as mock_call:
        await router.complete(messages=[{"role": "user", "content": "test"}])
    assert mock_call.call_args.kwargs["timeout"] == settings.ai_request_timeout


@pytest.mark.unit
async def test_complete_timeout_propagates_cleanly():
    """A stalled provider surfaces as a raised exception, not a hang."""
    router = ModelRouter(base_url="http://ollama:11434", default_model="ollama/llama3.2")
    with patch(
        "app.services.model_router.acompletion",
        new=AsyncMock(side_effect=TimeoutError("request timed out")),
    ):
        with pytest.raises(asyncio.TimeoutError):
            await router.complete(messages=[{"role": "user", "content": "test"}])


# ── _pick_provider exact-match preference (the "wrong key" class) ─────────────


def _fake_provider(*, ptype: str, default_model: str | None, label: str) -> MagicMock:
    """A minimal stand-in for a Provider row for _pick_provider selection."""
    p = MagicMock()
    p.type = ptype
    p.default_model = default_model
    p.label = label
    return p


@pytest.mark.unit
def test_pick_provider_prefers_exact_default_model_match():
    """Two enabled providers of the SAME type with DIFFERENT default_models →
    the one whose default_model matches the requested model EXACTLY wins, NOT
    just the first of that type. Guards against routing a request (and thus a
    decrypted API key) to the wrong provider."""
    first = _fake_provider(
        ptype="openai", default_model="openai/gpt-4o", label="GPT-4o acct"
    )
    exact = _fake_provider(
        ptype="openai",
        default_model="openai/text-embedding-3-small",
        label="Embeddings acct",
    )
    picked = _pick_provider(
        [first, exact], "openai", "openai/text-embedding-3-small"
    )
    assert picked is exact  # exact match wins over first-of-type
    assert picked.label == "Embeddings acct"


@pytest.mark.unit
def test_pick_provider_falls_back_to_first_of_type_when_no_exact_match():
    """No provider's default_model matches the requested model → fall back to the
    FIRST provider of that type."""
    first = _fake_provider(
        ptype="openai", default_model="openai/gpt-4o", label="First"
    )
    second = _fake_provider(
        ptype="openai", default_model="openai/gpt-4o-mini", label="Second"
    )
    picked = _pick_provider(
        [first, second], "openai", "openai/some-unconfigured-model"
    )
    assert picked is first  # first-of-type fallback


@pytest.mark.unit
def test_pick_provider_returns_none_when_no_provider_of_type():
    """No provider of the requested type at all → None."""
    other = _fake_provider(
        ptype="anthropic", default_model="anthropic/claude", label="Claude"
    )
    assert _pick_provider([other], "openai", "openai/gpt-4o") is None
