"""Provider connectivity checks and model discovery.

Kept separate from CRUD: this module performs the outbound network / LiteLLM
calls used by ``POST /providers/{id}/test`` and ``GET /providers/{id}/models``.
Secrets are decrypted only in-memory here and are NEVER logged or returned.
"""

import json
import logging
from collections.abc import AsyncIterator

import httpx
from alexandria_core.core.errors import safe_error as _safe_error
from alexandria_core.models.provider import Provider

from app.core.crypto import DecryptionError, decrypt_secret
from app.schemas.provider import ProviderModelInfo, ProviderTestResult

logger = logging.getLogger(__name__)

# Default Ollama endpoint when a provider has no explicit base_url (Docker
# Compose service name; local-first dev maps to http://localhost:11434).
_DEFAULT_OLLAMA_BASE = "http://ollama:11434"


class PullModelError(Exception):
    """Raised when an Ollama model pull cannot start or fails mid-stream.

    Carries a safe, bounded message (sanitized via ``safe_error``) so the
    endpoint can surface an actionable 5xx instead of an opaque 500. Used both
    for a misuse (pull requested on a non-Ollama provider) and a transport
    failure (Ollama unreachable / HTTP error).
    """

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
            base = provider.base_url or _DEFAULT_OLLAMA_BASE
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
        base = provider.base_url or _DEFAULT_OLLAMA_BASE
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


# Pulls can take many minutes for a multi-GB model — no overall timeout on the
# stream body (only a connect timeout so an unreachable host fails fast).
_PULL_TIMEOUT = httpx.Timeout(connect=10.0, read=None, write=10.0, pool=10.0)


async def pull_model(provider: Provider, model: str) -> AsyncIterator[dict]:
    """Stream an Ollama model download, yielding each NDJSON progress dict.

    POSTs ``{"model": <name>, "stream": true}`` to ``{base_url}/api/pull`` and
    yields Ollama's progress lines verbatim (parsed): ``{"status": ...}`` with
    optional ``completed``/``total`` byte counts, ending with
    ``{"status": "success"}``.

    Pull only makes sense for a local Ollama provider — a non-Ollama provider
    raises ``PullModelError`` before any request is made. A transport failure
    (Ollama unreachable) or a non-2xx response also raises ``PullModelError``
    with a bounded, sanitized message. Blank / unparsable keep-alive lines are
    skipped rather than crashing the stream.
    """
    if provider.type != "ollama":
        raise PullModelError("A modell letöltése csak Ollama providerhez érhető el.")

    base = provider.base_url or _DEFAULT_OLLAMA_BASE
    url = base.rstrip("/") + "/api/pull"
    body = {"model": model, "stream": True}
    try:
        async with httpx.AsyncClient(timeout=_PULL_TIMEOUT) as http:
            async with http.stream("POST", url, json=body) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line or not line.strip():
                        continue
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        # A non-JSON keep-alive must not abort the download.
                        continue
                    if isinstance(chunk, dict):
                        yield chunk
    except PullModelError:
        raise
    except Exception as exc:  # noqa: BLE001 — convert to a clear, bounded error
        logger.warning("Ollama pull failed for %s: %s", base, _safe_error(exc))
        raise PullModelError(_safe_error(exc)) from exc


def _default_probe_model(provider_type: str) -> str | None:
    catalog = STATIC_CLOUD_MODELS.get(provider_type)
    if catalog:
        return catalog[0].id
    return None
