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
    # Symmetric key used to encrypt provider API keys at rest (urlsafe base64,
    # 32 bytes). The value below is a DEV-ONLY default — production MUST set
    # PROVIDER_ENCRYPTION_KEY in the environment. Generate one with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    # This key is never logged or returned by the API.
    provider_encryption_key: str = "QZLI5qOqi-Kyme0ePk4r7_j12xYvUzrd3RrEKz2sftw="


settings = Settings()
