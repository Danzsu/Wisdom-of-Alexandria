from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from alexandria_core.models.base import Base, Timestamps, UUIDPrimaryKey


class Provider(UUIDPrimaryKey, Timestamps, Base):
    """An AI provider configuration (local Ollama or a cloud LLM provider).

    The API key is stored encrypted at rest in ``api_key_encrypted``. The
    plaintext key is never persisted, logged, or returned by the API.
    """

    __tablename__ = "providers"

    # ollama | gemini | anthropic | openai | openrouter | custom
    type: Mapped[str] = mapped_column(String(50), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    # Encrypted ciphertext of the API key. Nullable: local Ollama needs no key.
    api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    default_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Optional embedding model for this provider (used by RAG). Recommended
    # cloud default: OpenAI ``text-embedding-3-small`` (1536-dim). Nullable:
    # providers that do not serve embeddings (or local Ollama) may leave it unset.
    embedding_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Optional image-generation model for this provider (AI image generation,
    # Phase 1). Cloud example: ``gemini/gemini-3.1-flash-image``. Nullable:
    # providers that do not serve image generation may leave it unset.
    image_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
