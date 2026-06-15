"""Unit/integration tests for ModelRouter.embed (B2a).

Mirrors the complete()/provider-threading tests: the outbound litellm
``aembedding`` is mocked, and we assert the resolved api_key/base_url reach it
(proving resolve_provider ran via the threaded db), that the returned vectors are
parsed correctly, and that failures are loud + sanitizable without leaking keys.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from alexandria_core.models.provider import Provider
from sqlalchemy import delete

from app.core.errors import safe_error
from app.schemas.provider import ProviderCreate
from app.services.crud_provider import create_provider
from app.services.model_router import ModelRouter


@pytest.fixture(autouse=True)
async def _clean_providers(db_session):
    await db_session.execute(delete(Provider))
    await db_session.commit()
    yield
    await db_session.execute(delete(Provider))
    await db_session.commit()


def _embedding_response(vectors: list[list[float]]):
    """Build a LiteLLM-shaped EmbeddingResponse mock (OpenAI-compatible)."""
    resp = MagicMock()
    resp.data = [{"embedding": v, "index": i} for i, v in enumerate(vectors)]
    return resp


@pytest.mark.unit
async def test_embed_returns_vectors_without_db():
    router = ModelRouter(base_url="http://ollama:11434", default_model="ollama/llama3.2")
    with patch(
        "app.services.model_router.aembedding",
        new=AsyncMock(return_value=_embedding_response([[0.1, 0.2], [0.3, 0.4]])),
    ) as mock_call:
        vectors = await router.embed(
            ["első szöveg", "második szöveg"], model="ollama/nomic-embed-text"
        )
    assert vectors == [[0.1, 0.2], [0.3, 0.4]]
    # All entries are floats (parsed), not raw mock objects.
    assert all(isinstance(x, float) for v in vectors for x in v)
    # input was threaded straight through.
    assert mock_call.call_args.kwargs["input"] == ["első szöveg", "második szöveg"]
    assert mock_call.call_args.kwargs["model"] == "ollama/nomic-embed-text"


@pytest.mark.unit
async def test_embed_raises_on_partial_batch():
    """A response with fewer vectors than inputs must RAISE — the caller maps
    vectors back to entities by position, so a short batch would silently
    misalign embeddings to the wrong entity. Never return fewer than asked."""
    router = ModelRouter()
    with patch(
        "app.services.model_router.aembedding",
        new=AsyncMock(return_value=_embedding_response([[0.1, 0.2]])),  # 1 for 2
    ):
        with pytest.raises(ValueError, match="1 vectors for 2 input"):
            await router.embed(["a", "b"], model="ollama/nomic-embed-text")


@pytest.mark.unit
async def test_embed_passes_timeout():
    from alexandria_core.core.config import settings

    router = ModelRouter()
    with patch(
        "app.services.model_router.aembedding",
        new=AsyncMock(return_value=_embedding_response([[0.0]])),
    ) as mock_call:
        await router.embed(["x"], model="ollama/nomic-embed-text")
    assert mock_call.call_args.kwargs["timeout"] == settings.ai_request_timeout


@pytest.mark.integration
async def test_embed_uses_configured_cloud_provider_key(db_session):
    """With an enabled cloud Provider row + a cloud model string, the decrypted
    api_key and resolved base_url reach aembedding — proving resolve_provider ran
    via the threaded db (same guarantee as the complete() threading test)."""
    await create_provider(
        db_session,
        ProviderCreate(
            type="openai",
            label="OpenAI Embeddings",
            api_key="sk-embed-secret-xyz",
            base_url="https://api.openai.example/v1",
            default_model="openai/gpt-4o",
            embedding_model="openai/text-embedding-3-small",
        ),
    )
    router = ModelRouter()
    with patch(
        "app.services.model_router.aembedding",
        new=AsyncMock(return_value=_embedding_response([[0.5, 0.6, 0.7]])),
    ) as mock_call:
        vectors = await router.embed(
            ["beágyazandó szöveg"],
            model="openai/text-embedding-3-small",
            db=db_session,
        )
    kwargs = mock_call.call_args.kwargs
    assert kwargs["api_key"] == "sk-embed-secret-xyz"
    assert kwargs["api_base"] == "https://api.openai.example/v1"
    assert kwargs["model"] == "openai/text-embedding-3-small"
    assert vectors == [[0.5, 0.6, 0.7]]


@pytest.mark.integration
async def test_embed_undecryptable_key_raises_not_unauthenticated(db_session):
    """An undecryptable stored key must fail loudly (DecryptionError -> clear
    RuntimeError from resolve_provider), never silently send an unauthenticated
    embedding request."""
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
        "app.services.model_router.aembedding",
        new=AsyncMock(return_value=_embedding_response([[0.0]])),
    ) as mock_call:
        with pytest.raises(RuntimeError, match="could not be decrypted"):
            await router.embed(
                ["x"], model="openai/text-embedding-3-small", db=db_session
            )
    mock_call.assert_not_called()


@pytest.mark.integration
async def test_embed_failure_is_loud_and_sanitizable_without_key_leak(db_session):
    """A provider-side embedding failure propagates (loud), and safe_error
    produces a bounded, single-line message. The raw exception must not embed the
    key (the provider layer never puts the key in exception text); we assert the
    sanitized form is clean and bounded."""
    await create_provider(
        db_session,
        ProviderCreate(
            type="openai",
            label="OpenAI Embeddings",
            api_key="sk-embed-secret-zzz",
            default_model="openai/gpt-4o",
            embedding_model="openai/text-embedding-3-small",
        ),
    )
    router = ModelRouter()
    raw = "embedding provider boom\n401 Unauthorized\n" + ("y" * 4000)
    with patch(
        "app.services.model_router.aembedding",
        new=AsyncMock(side_effect=RuntimeError(raw)),
    ) as mock_call:
        with pytest.raises(RuntimeError) as exc_info:
            await router.embed(
                ["x"], model="openai/text-embedding-3-small", db=db_session
            )
    # The failure came from the provider call itself (not a pre-call path).
    mock_call.assert_called_once()

    # The decrypted key must never appear in the raised exception text.
    assert "sk-embed-secret-zzz" not in str(exc_info.value)

    sanitized = safe_error(exc_info.value)
    assert "\n" not in sanitized
    assert len(sanitized) <= 300
    assert "sk-embed-secret-zzz" not in sanitized
