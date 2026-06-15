from alexandria_core.core.config import settings


def test_settings_has_database_url():
    assert settings.database_url
    assert "postgresql" in settings.database_url or "sqlite" in settings.database_url


def test_settings_default_admin_username():
    assert settings.admin_username == "admin"


def test_settings_default_admin_password():
    assert settings.admin_password == "changeme"


def test_settings_access_token_expire_positive():
    assert settings.access_token_expire_minutes > 0


def test_settings_default_local_model():
    assert settings.default_local_model
    assert "/" in settings.default_local_model  # e.g. "ollama/llama3.2"


def test_settings_secret_key_not_empty():
    assert len(settings.secret_key) > 0
