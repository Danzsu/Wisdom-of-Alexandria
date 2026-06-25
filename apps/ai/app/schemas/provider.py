import uuid
from datetime import datetime
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, Field, field_validator

# Supported provider types. ``custom`` is any OpenAI-compatible endpoint.
ProviderType = Literal["ollama", "gemini", "anthropic", "openai", "openrouter", "custom"]


def _validate_base_url(value: str | None) -> str | None:
    """Reject a ``base_url`` that is not a well-formed ``http(s)`` URL.

    The base_url is used verbatim as the outbound LiteLLM/HTTP endpoint, so a
    non-http scheme (``file://``, ``ftp://``) or a malformed string must not pass
    the schema boundary. We enforce scheme (http/https) + a non-empty host only.

    LOCAL-FIRST: loopback/localhost is the PRIMARY use case (Ollama runs at
    ``http://localhost:11434``), so it is explicitly allowed.

    # TODO: block private/link-local ranges when this deploys multi-user/cloud.
    """
    if value is None:
        return None
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("base_url must be a valid http:// or https:// URL")
    return value


class ProviderCreate(BaseModel):
    type: ProviderType
    label: str = Field(..., min_length=1, max_length=255)
    # PLAINTEXT api key on input — encrypted by the service before persistence.
    api_key: str | None = Field(default=None, min_length=1)
    base_url: str | None = Field(default=None, max_length=512)
    default_model: str | None = Field(default=None, max_length=255)
    # Optional embedding model (RAG). Cloud default: OpenAI text-embedding-3-small.
    embedding_model: str | None = Field(default=None, max_length=255)
    # Optional image-generation model. Cloud example: gemini/gemini-3.1-flash-image.
    image_model: str | None = Field(default=None, max_length=255)
    enabled: bool = True

    _validate_base_url = field_validator("base_url")(_validate_base_url)


class ProviderUpdate(BaseModel):
    type: ProviderType | None = None
    label: str | None = Field(default=None, min_length=1, max_length=255)
    # If provided -> re-encrypt. If omitted -> existing key is kept untouched.
    api_key: str | None = Field(default=None, min_length=1)
    base_url: str | None = Field(default=None, max_length=512)
    default_model: str | None = Field(default=None, max_length=255)
    embedding_model: str | None = Field(default=None, max_length=255)
    image_model: str | None = Field(default=None, max_length=255)
    enabled: bool | None = None

    _validate_base_url = field_validator("base_url")(_validate_base_url)


class ProviderRead(BaseModel):
    """Safe read view of a provider.

    Deliberately exposes ONLY a masked key + a ``has_key`` flag. The plaintext
    api_key and the stored ciphertext (api_key_encrypted) are NEVER present here.
    """

    id: uuid.UUID
    type: str
    label: str
    api_key_masked: str | None
    has_key: bool
    base_url: str | None
    default_model: str | None
    embedding_model: str | None
    image_model: str | None
    enabled: bool
    created_at: datetime
    updated_at: datetime


class ProviderTestResult(BaseModel):
    ok: bool
    detail: str


class ProviderPullRequest(BaseModel):
    """Request body for ``POST /providers/{id}/models/pull``.

    ``model`` is interpolated into the Ollama ``/api/pull`` JSON body, so there
    is no injection surface, but we still cap length and restrict the charset to
    a sane Ollama tag (``namespace/name:tag``) — letters, digits and the small
    set of separators Ollama model refs use. This rejects whitespace/control
    chars and pathologically long input at the schema boundary (422).
    """

    model: str = Field(..., min_length=1, max_length=128)

    @field_validator("model")
    @classmethod
    def _validate_model(cls, value: str) -> str:
        candidate = value.strip()
        if not candidate:
            raise ValueError("A modell neve nem lehet üres.")
        allowed = set(
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-:/"
        )
        if not all(ch in allowed for ch in candidate):
            raise ValueError(
                "A modell neve csak betűket, számokat és a . _ - : / jeleket tartalmazhat."
            )
        return candidate


class ProviderModelInfo(BaseModel):
    id: str
    label: str


class ProviderModelsResult(BaseModel):
    models: list[ProviderModelInfo]
