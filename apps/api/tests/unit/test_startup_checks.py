"""SECRET_KEY startup guard — fires only for dev-default key + non-dev env."""

import logging

import pytest

from app.core.startup_checks import (
    DEV_DEFAULT_SECRET_KEY,
    warn_if_default_secret_in_production,
)


@pytest.fixture(autouse=True)
def _reenable_module_logger():
    """Undo cross-test logger pollution from the alembic tests.

    The alembic round-trip tests run ``logging.config.fileConfig`` (via
    alembic.ini) whose default ``disable_existing_loggers=True`` flips
    ``disabled=True`` on every already-instantiated logger — including
    ``app.core.startup_checks``'s module logger — which would silently
    swallow the CRITICAL record these tests assert on. Runtime is unaffected
    (the container entrypoint runs alembic in a separate process).
    """
    module_logger = logging.getLogger("app.core.startup_checks")
    was_disabled = module_logger.disabled
    module_logger.disabled = False
    yield
    module_logger.disabled = was_disabled


@pytest.mark.parametrize(
    ("secret_key", "environ", "should_warn"),
    [
        # Dev-default key in a production-looking env: WARN.
        (DEV_DEFAULT_SECRET_KEY, {"ENVIRONMENT": "production"}, True),
        (DEV_DEFAULT_SECRET_KEY, {"ENVIRONMENT": "Production"}, True),  # case-insensitive
        (DEV_DEFAULT_SECRET_KEY, {"ENVIRONMENT": " prod "}, True),  # whitespace-tolerant
        (DEV_DEFAULT_SECRET_KEY, {"ENVIRONMENT": "staging"}, True),
        (DEV_DEFAULT_SECRET_KEY, {"ENV": "production"}, True),  # ENV fallback
        # Dev-default key but a dev-looking (or absent) env: quiet.
        (DEV_DEFAULT_SECRET_KEY, {}, False),
        (DEV_DEFAULT_SECRET_KEY, {"ENVIRONMENT": "development"}, False),
        (DEV_DEFAULT_SECRET_KEY, {"ENVIRONMENT": "local"}, False),
        (DEV_DEFAULT_SECRET_KEY, {"ENVIRONMENT": ""}, False),
        # Real key: quiet everywhere, including production.
        ("a-strong-rotated-secret", {"ENVIRONMENT": "production"}, False),
        ("a-strong-rotated-secret", {}, False),
    ],
)
def test_warn_matrix(
    secret_key: str,
    environ: dict[str, str],
    should_warn: bool,
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level(logging.CRITICAL, logger="app.core.startup_checks"):
        fired = warn_if_default_secret_in_production(secret_key, environ)

    assert fired is should_warn
    critical_records = [r for r in caplog.records if r.levelno == logging.CRITICAL]
    if should_warn:
        assert len(critical_records) == 1
        assert "SECRET_KEY" in critical_records[0].getMessage()
    else:
        assert critical_records == []


def test_environment_takes_precedence_over_env(caplog: pytest.LogCaptureFixture) -> None:
    """ENVIRONMENT=development must silence the guard even if ENV=production."""
    with caplog.at_level(logging.CRITICAL, logger="app.core.startup_checks"):
        fired = warn_if_default_secret_in_production(
            DEV_DEFAULT_SECRET_KEY,
            {"ENVIRONMENT": "development", "ENV": "production"},
        )
    assert fired is False


def test_guard_never_raises_and_reads_os_environ_by_default() -> None:
    """Default (no mapping) path reads os.environ without blowing up."""
    assert warn_if_default_secret_in_production("some-key") in (True, False)


def test_dev_default_constant_matches_settings_default() -> None:
    """The guard's literal must track the actual committed Settings default.

    If someone changes the default in alexandria_core, this test forces the
    guard to be updated in the same change (otherwise it silently checks a
    stale string and never fires).
    """
    from alexandria_core.core.config import Settings

    assert Settings.model_fields["secret_key"].default == DEV_DEFAULT_SECRET_KEY
