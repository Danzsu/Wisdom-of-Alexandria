"""Unit tests for ModelRouter provider resolution (DB-backed key lookup)."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from alexandria_core.models.provider import Provider
from sqlalchemy import delete

from app.schemas.provider import ProviderCreate
from app.services.crud_provider import create_provider
from app.services.model_router import ModelRouter


@pytest.fixture(autouse=True)
async def _clean_providers(db_session):
    """Providers are a global (non-project-scoped) table; CRUD commits persist
    across tests on the shared engine. Clear them so each test is isolated."""
    await db_session.execute(delete(Provider))
    await db_session.commit()
    yield
    await db_session.execute(delete(Provider))
    await db_session.commit()


def _mock_response(content: str = "ok"):
    resp = MagicMock()
    resp.choices = [MagicMock()]
    resp.choices[0].message.content = content
    resp.usage.prompt_tokens = 1
    resp.usage.completion_tokens = 1
    resp.usage.total_tokens = 2
    return resp


@pytest.mark.integration
async def test_resolve_provider_returns_decrypted_key(db_session):
    await create_provider(
        db_session,
        ProviderCreate(
            type="anthropic",
            label="Claude",
            api_key="sk-ant-secret-xyz",
            default_model="anthropic/claude-3-5-sonnet-latest",
        ),
    )
    router = ModelRouter()
    resolved = await router.resolve_provider(db_session, "anthropic/claude-3-5-sonnet-latest")
    # The router decrypts the stored ciphertext back to the original key.
    assert resolved.api_key == "sk-ant-secret-xyz"


@pytest.mark.integration
async def test_complete_passes_provider_key_to_litellm(db_session):
    await create_provider(
        db_session,
        ProviderCreate(
            type="openai",
            label="OpenAI",
            api_key="sk-openai-abc123",
            base_url="https://api.openai.com/v1",
        ),
    )
    router = ModelRouter()
    with patch(
        "app.services.model_router.acompletion",
        new=AsyncMock(return_value=_mock_response()),
    ) as mock_call:
        await router.complete(
            messages=[{"role": "user", "content": "hi"}],
            model="openai/gpt-4o",
            db=db_session,
        )
    kwargs = mock_call.call_args.kwargs
    assert kwargs["api_key"] == "sk-openai-abc123"
    assert kwargs["api_base"] == "https://api.openai.com/v1"
    assert kwargs["model"] == "openai/gpt-4o"


@pytest.mark.integration
async def test_complete_ollama_default_without_db_is_backcompat():
    """No db + ollama model -> uses settings base URL, no key (legacy path)."""
    router = ModelRouter(base_url="http://ollama:11434", default_model="ollama/llama3.2")
    with patch(
        "app.services.model_router.acompletion",
        new=AsyncMock(return_value=_mock_response()),
    ) as mock_call:
        await router.complete(messages=[{"role": "user", "content": "hi"}])
    kwargs = mock_call.call_args.kwargs
    assert kwargs["api_base"] == "http://ollama:11434"
    assert kwargs["api_key"] is None


@pytest.mark.integration
async def test_resolve_provider_no_match_falls_back_to_settings(db_session):
    """A cloud model with no configured provider -> no key, no base URL."""
    router = ModelRouter()
    resolved = await router.resolve_provider(db_session, "gemini/gemini-1.5-pro")
    assert resolved.api_key is None
    assert resolved.base_url is None


@pytest.mark.integration
async def test_resolve_provider_disabled_is_ignored(db_session):
    await create_provider(
        db_session,
        ProviderCreate(
            type="openai",
            label="Disabled OpenAI",
            api_key="sk-should-not-be-used",
            enabled=False,
        ),
    )
    router = ModelRouter()
    resolved = await router.resolve_provider(db_session, "openai/gpt-4o")
    # Disabled providers are not used for resolution.
    assert resolved.api_key is None


# ── FIX 1: undecryptable stored key must fail loudly, not send None silently ──


@pytest.mark.integration
async def test_resolve_provider_no_stored_key_is_ollama_none(db_session):
    """A provider with NO stored key (e.g. local Ollama) legitimately resolves
    to api_key=None — this is the path that must KEEP working."""
    await create_provider(
        db_session,
        ProviderCreate(
            type="ollama",
            label="Local Ollama",
            api_key=None,
            default_model="ollama/llama3.2",
        ),
    )
    router = ModelRouter()
    resolved = await router.resolve_provider(db_session, "ollama/llama3.2")
    assert resolved.api_key is None


@pytest.mark.integration
async def test_resolve_provider_undecryptable_key_raises(db_session):
    """A stored-but-undecryptable key (rotated/corrupted) must raise a clear
    error instead of silently proceeding with api_key=None."""
    # Insert a provider whose ciphertext is bogus, bypassing encrypt_secret so it
    # cannot be decrypted (simulates a key rotation against existing ciphertext).
    provider = Provider(
        type="openai",
        label="Corrupted Key",
        api_key_encrypted="not-a-valid-fernet-token",
        enabled=True,
    )
    db_session.add(provider)
    await db_session.commit()

    router = ModelRouter()
    with pytest.raises(RuntimeError, match="could not be decrypted"):
        await router.resolve_provider(db_session, "openai/gpt-4o")


@pytest.mark.integration
async def test_complete_undecryptable_key_raises_not_unauthenticated(db_session):
    """complete() must fail loudly on an undecryptable key — never fall through
    to an unauthenticated LiteLLM call. acompletion is patched so that if the
    router DID proceed, the test would fail (mock asserted not called)."""
    provider = Provider(
        type="openai",
        label="Corrupted Key",
        api_key_encrypted="not-a-valid-fernet-token",
        enabled=True,
    )
    db_session.add(provider)
    await db_session.commit()

    router = ModelRouter()
    with patch(
        "app.services.model_router.acompletion",
        new=AsyncMock(return_value=_mock_response()),
    ) as mock_call:
        with pytest.raises(RuntimeError, match="could not be decrypted"):
            await router.complete(
                messages=[{"role": "user", "content": "hi"}],
                model="openai/gpt-4o",
                db=db_session,
            )
    # The unauthenticated request must never have been attempted.
    mock_call.assert_not_called()
