"""Provider connectivity checks and model discovery.

Kept separate from CRUD: this module performs the outbound network / LiteLLM
calls used by ``POST /providers/{id}/test`` and ``GET /providers/{id}/models``.
Secrets are decrypted only in-memory here and are NEVER logged or returned.
"""

import logging

import httpx
from alexandria_core.core.errors import safe_error as _safe_error
from alexandria_core.models.provider import Provider

from app.core.crypto import DecryptionError, decrypt_secret
from app.schemas.provider import ProviderModelInfo, ProviderTestResult

logger = logging.getLogger(__name__)

# Static, well-known model catalogs per cloud provider type. The UI must not
# hardcode model names (CLAUDE.md); it reads them from the API. These are the
# canonical LiteLLM-style identifiers. Ollama is dynamic (queried at runtime).
STATIC_CLOUD_MODELS: dict[str, list[ProviderModelInfo]] = {
    "gemini": [
        ProviderModelInfo(id="gemini/gemini-1.5-pro", label="Gemini 1.5 Pro"),
        ProviderModelInfo(id="gemini/gemini-1.5-flash", label="Gemini 1.5 Flash"),
        ProviderModelInfo(id="gemini/gemini-2.0-flash", label="Gemini 2.0 Flash"),
    ],
    "anthropic": [
        ProviderModelInfo(id="anthropic/claude-3-5-sonnet-latest", label="Claude 3.5 Sonnet"),
        ProviderModelInfo(id="anthropic/claude-3-5-haiku-latest", label="Claude 3.5 Haiku"),
        ProviderModelInfo(id="anthropic/claude-3-opus-latest", label="Claude 3 Opus"),
    ],
    "openai": [
        ProviderModelInfo(id="openai/gpt-4o", label="GPT-4o"),
        ProviderModelInfo(id="openai/gpt-4o-mini", label="GPT-4o mini"),
        ProviderModelInfo(id="openai/gpt-4-turbo", label="GPT-4 Turbo"),
    ],
    "openrouter": [
        ProviderModelInfo(
            id="openrouter/anthropic/claude-3.5-sonnet",
            label="Claude 3.5 Sonnet (OpenRouter)",
        ),
        ProviderModelInfo(id="openrouter/openai/gpt-4o", label="GPT-4o (OpenRouter)"),
        ProviderModelInfo(
            id="openrouter/google/gemini-pro-1.5", label="Gemini Pro 1.5 (OpenRouter)"
        ),
    ],
}


def _decrypt_key(provider: Provider) -> str | None:
    if not provider.api_key_encrypted:
        return None
    try:
        return decrypt_secret(provider.api_key_encrypted)
    except DecryptionError:
        return None


async def _ping_ollama(base_url: str) -> ProviderTestResult:
    url = base_url.rstrip("/") + "/api/tags"
    async with httpx.AsyncClient(timeout=10.0) as http:
        resp = await http.get(url)
        resp.raise_for_status()
    return ProviderTestResult(ok=True, detail="Ollama elérhető.")


async def _ollama_models(base_url: str) -> list[ProviderModelInfo]:
    url = base_url.rstrip("/") + "/api/tags"
    async with httpx.AsyncClient(timeout=10.0) as http:
        resp = await http.get(url)
        resp.raise_for_status()
        payload = resp.json()
    models: list[ProviderModelInfo] = []
    for entry in payload.get("models", []):
        name = entry.get("name") or entry.get("model")
        if not name:
            continue
        models.append(ProviderModelInfo(id=f"ollama/{name}", label=name))
    return models


async def check_provider(provider: Provider) -> ProviderTestResult:
    """Validate reachability / credentials for a provider.

    Returns ``ok=False`` with a human-readable detail on any failure. Never
    leaks the API key into the detail/exception text.
    """
    try:
        if provider.type == "ollama":
            base = provider.base_url or "http://ollama:11434"
            return await _ping_ollama(base)

        # Cloud providers: a missing key is a configuration error.
        key = _decrypt_key(provider)
        if not key:
            return ProviderTestResult(
                ok=False, detail="Nincs API-kulcs beállítva ehhez a szolgáltatóhoz."
            )

        # Lightweight auth check via LiteLLM. We attempt a minimal completion;
        # an auth/credentials failure surfaces a clear error without exposing
        # the key. Imported lazily so unit tests can patch acompletion.
        from litellm import acompletion

        model = provider.default_model or _default_probe_model(provider.type)
        if model is None:
            return ProviderTestResult(
                ok=False,
                detail="Nincs alapértelmezett modell a teszteléshez.",
            )
        await acompletion(
            model=model,
            messages=[{"role": "user", "content": "ping"}],
            api_key=key,
            api_base=provider.base_url,
            max_tokens=1,
        )
        return ProviderTestResult(ok=True, detail="A szolgáltató elérhető.")
    except Exception as exc:  # noqa: BLE001 — convert to a structured result
        return ProviderTestResult(ok=False, detail=_safe_error(exc))


async def list_provider_models(provider: Provider) -> list[ProviderModelInfo]:
    """List the models available for a provider.

    Ollama is queried live; cloud providers return their static catalog. On a
    failure for Ollama we return an empty list rather than raising.
    """
    if provider.type == "ollama":
        base = provider.base_url or "http://ollama:11434"
        try:
            return await _ollama_models(base)
        except Exception as e:  # noqa: BLE001 — unreachable Ollama -> no models
            # An empty list is a valid "no models" result, but the failure must
            # not be silent. Log it (sanitized — never the key/ciphertext) so an
            # operator can diagnose an unreachable/misconfigured Ollama.
            logger.warning(
                "Failed to fetch Ollama models from %s: %s", base, _safe_error(e)
            )
            return []
    return list(STATIC_CLOUD_MODELS.get(provider.type, []))


def _default_probe_model(provider_type: str) -> str | None:
    catalog = STATIC_CLOUD_MODELS.get(provider_type)
    if catalog:
        return catalog[0].id
    return None
