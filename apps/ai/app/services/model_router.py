import logging
from dataclasses import dataclass
from typing import Any

from alexandria_core.core.config import settings
from alexandria_core.models.provider import Provider
from litellm import acompletion, aembedding
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import DecryptionError, decrypt_secret

logger = logging.getLogger(__name__)


@dataclass
class ModelResponse:
    content: str
    model: str
    usage: dict[str, int]


@dataclass
class ResolvedProvider:
    """Credentials/config resolved for a given model string."""

    api_key: str | None
    base_url: str | None


_OLLAMA_PREFIX = "ollama/"

# Maps a model-string prefix to the Provider.type that serves it.
_PREFIX_TO_TYPE: dict[str, str] = {
    _OLLAMA_PREFIX: "ollama",
    "gemini/": "gemini",
    "anthropic/": "anthropic",
    "claude": "anthropic",
    "openai/": "openai",
    "gpt-": "openai",
    "openrouter/": "openrouter",
}


def _provider_type_for_model(model: str) -> str | None:
    for prefix, ptype in _PREFIX_TO_TYPE.items():
        if model.startswith(prefix):
            return ptype
    return None


def _pick_provider(providers: list[Provider], ptype: str, model: str) -> Provider | None:
    """Prefer a provider whose default_model matches exactly, else first of type."""
    exact = next((p for p in providers if p.type == ptype and p.default_model == model), None)
    if exact is not None:
        return exact
    return next((p for p in providers if p.type == ptype), None)


class ModelRouter:
    """Central LiteLLM abstraction. All AI calls go through this."""

    def __init__(self, base_url: str | None = None, default_model: str | None = None):
        self.base_url = base_url or settings.ollama_base_url
        self.default_model = default_model or settings.default_local_model

    async def resolve_provider(self, db: AsyncSession, model: str) -> ResolvedProvider:
        """Resolve a model string to a configured + enabled Provider's creds.

        Falls back to settings (Ollama base URL / no key) when no matching
        provider row exists — preserving the pre-provider behaviour.
        """
        ptype = _provider_type_for_model(model)
        provider: Provider | None = None
        if ptype is not None:
            from app.services.crud_provider import list_providers

            providers = await list_providers(db, enabled_only=True)
            provider = _pick_provider(providers, ptype, model)

        if provider is None:
            # Back-compat default: Ollama uses the settings base URL, others
            # rely on environment vars LiteLLM already reads.
            base = self.base_url if model.startswith(_OLLAMA_PREFIX) else None
            return ResolvedProvider(api_key=None, base_url=base)

        api_key: str | None = None
        # Distinguish "no key stored" (legitimate — e.g. local Ollama) from
        # "key stored but decrypt FAILED" (rotated/corrupted key). The former
        # keeps api_key = None; the latter must fail loudly here instead of
        # silently sending an unauthenticated request that surfaces only as an
        # opaque downstream auth error.
        if provider.api_key_encrypted:
            try:
                api_key = decrypt_secret(provider.api_key_encrypted)
            except DecryptionError as exc:
                # Never log the key or ciphertext — only the provider id + cause.
                logger.warning(
                    "Provider %s has a stored API key that could not be decrypted "
                    "(key rotated or corrupted?)",
                    provider.id,
                )
                raise RuntimeError(
                    f"Provider {provider.id} API key could not be decrypted "
                    "(key rotated or corrupted?)"
                ) from exc
        base_url = provider.base_url
        if base_url is None and provider.type == "ollama":
            base_url = self.base_url
        return ResolvedProvider(api_key=api_key, base_url=base_url)

    async def complete(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        db: AsyncSession | None = None,
        **kwargs: Any,
    ) -> ModelResponse:
        resolved_model = model or self.default_model

        api_key: str | None = None
        if db is not None:
            resolved = await self.resolve_provider(db, resolved_model)
            api_base = resolved.base_url
            api_key = resolved.api_key
        else:
            # No DB context: keep legacy behaviour (Ollama base URL by prefix).
            api_base = self.base_url if resolved_model.startswith(_OLLAMA_PREFIX) else None

        # Hard timeout so a stalled provider cannot hang the request/worker
        # forever. LiteLLM raises a Timeout exception on expiry, which flows up
        # to AIService.fail_job + the sanitized 502. A caller may override via
        # kwargs (e.g. a longer full-book job in V1).
        kwargs.setdefault("timeout", settings.ai_request_timeout)
        response = await acompletion(
            model=resolved_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            api_base=api_base,
            api_key=api_key,
            **kwargs,
        )
        content = response.choices[0].message.content or ""
        usage = {
            "prompt_tokens": getattr(response.usage, "prompt_tokens", 0) or 0,
            "completion_tokens": getattr(response.usage, "completion_tokens", 0) or 0,
            "total_tokens": getattr(response.usage, "total_tokens", 0) or 0,
        }
        return ModelResponse(content=content, model=resolved_model, usage=usage)

    async def embed(
        self,
        texts: list[str],
        model: str,
        db: AsyncSession | None = None,
        **kwargs: Any,
    ) -> list[list[float]]:
        """Embed a batch of texts via LiteLLM ``aembedding``.

        Mirrors ``complete()``: resolves the configured provider (api_key /
        base_url) through ``resolve_provider`` when a ``db`` is given, applies the
        same hard timeout, and surfaces failures loudly. An undecryptable stored
        key raises (propagated from ``resolve_provider``) rather than silently
        sending an unauthenticated request. Returns one vector per input text,
        in input order.
        """
        api_key: str | None = None
        if db is not None:
            resolved = await self.resolve_provider(db, model)
            api_base = resolved.base_url
            api_key = resolved.api_key
        else:
            # No DB context: keep the same Ollama-by-prefix fallback as complete().
            api_base = self.base_url if model.startswith(_OLLAMA_PREFIX) else None

        # Same hard timeout as complete() so a stalled embedding provider cannot
        # hang the request/worker forever; LiteLLM raises on expiry and the
        # exception flows up to the caller's sanitized failure handling.
        kwargs.setdefault("timeout", settings.ai_request_timeout)
        response = await aembedding(
            model=model,
            input=texts,
            api_base=api_base,
            api_key=api_key,
            **kwargs,
        )
        # OpenAI-compatible shape: response.data is an ordered list of items each
        # carrying an ``embedding`` list. Support both attribute and mapping
        # access (LiteLLM objects support both) without leaking anything else.
        vectors: list[list[float]] = []
        for item in response.data:
            emb = item["embedding"] if isinstance(item, dict) else item.embedding
            vectors.append([float(x) for x in emb])
        # Fail loudly on a partial batch: the caller maps vectors back to entities
        # BY POSITION, so a short response would silently misalign embeddings to the
        # wrong entity ids (corrupting the index). Never return fewer than asked.
        if len(vectors) != len(texts):
            raise ValueError(
                f"Embedding provider returned {len(vectors)} vectors for "
                f"{len(texts)} input(s)"
            )
        return vectors

    def build_messages(self, system: str, user: str) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]


# Module-level singleton — import and use directly in services
model_router = ModelRouter()
