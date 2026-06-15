from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    database_url: str = "postgresql+asyncpg://forgewriter:forgewriter@localhost:5432/forgewriter"
    redis_url: str = "redis://localhost:6379"
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    admin_username: str = "admin"
    admin_password: str = "changeme"
    allowed_origins: list[str] = ["http://localhost:3000"]
    ollama_base_url: str = "http://ollama:11434"
    default_local_model: str = "ollama/llama3.2"
    # Hard ceiling (seconds) for a single outbound LLM completion. Without it,
    # a stalled provider would hang the request/worker indefinitely. On timeout
    # the exception surfaces as a clean sanitized failure (failed job + 502).
    ai_request_timeout: float = 60.0
    # Symmetric key used to encrypt provider API keys at rest (urlsafe base64,
    # 32 bytes). REQUIRED — there is intentionally NO committed default, so a
    # missing key fails loudly rather than silently using a known-insecure
    # value. Set PROVIDER_ENCRYPTION_KEY in the environment. Generate one with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    # This key is never logged or returned by the API.
    provider_encryption_key: str | None = None


settings = Settings()
