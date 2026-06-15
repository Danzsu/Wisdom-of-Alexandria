from sqlalchemy import Boolean, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, Timestamps, UUIDPrimaryKey


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
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
