import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# Supported provider types. ``custom`` is any OpenAI-compatible endpoint.
ProviderType = Literal["ollama", "gemini", "anthropic", "openai", "openrouter", "custom"]


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


class ProviderModelInfo(BaseModel):
    id: str
    label: str


class ProviderModelsResult(BaseModel):
    models: list[ProviderModelInfo]
