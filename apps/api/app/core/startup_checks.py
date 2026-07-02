"""Startup sanity checks (loud warnings, never crashes).

Currently one check: a production-looking deployment running with the known
committed dev SECRET_KEY default. That combination means every JWT the app
signs is forgeable by anyone who has read the repo — worth screaming about.
It intentionally LOGS CRITICAL instead of raising: local dev and the compose
defaults legitimately run with the dev key, and even a misconfigured prod
should stay reachable while the operator rotates the key.
"""

import logging
import os
from collections.abc import Mapping

logger = logging.getLogger(__name__)

# The committed default from alexandria_core.core.config.Settings.secret_key
# (also the docker-compose fallback). Duplicated as a literal on purpose: the
# check must recognize THIS known-public string, not whatever the setting's
# default happens to be in the future.
DEV_DEFAULT_SECRET_KEY = "dev-secret-key-change-in-production"

# ENVIRONMENT / ENV values that mark a deployment as non-dev.
_NON_DEV_ENVIRONMENTS = frozenset({"production", "prod", "staging"})


def warn_if_default_secret_in_production(
    secret_key: str,
    environ: Mapping[str, str] | None = None,
) -> bool:
    """Log CRITICAL if the dev-default SECRET_KEY runs in a non-dev environment.

    The environment is read from ``ENVIRONMENT`` (preferred) or ``ENV``.
    Returns True when the warning fired (tested contract); never raises.
    """
    env = os.environ if environ is None else environ
    env_name = (env.get("ENVIRONMENT") or env.get("ENV") or "").strip().lower()

    if secret_key == DEV_DEFAULT_SECRET_KEY and env_name in _NON_DEV_ENVIRONMENTS:
        logger.critical(
            "SECRET_KEY is the committed dev default while ENVIRONMENT=%r — "
            "every issued JWT is forgeable. Set a strong SECRET_KEY "
            "immediately (e.g. `openssl rand -hex 32`).",
            env_name,
        )
        return True
    return False
