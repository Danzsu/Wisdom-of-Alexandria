"""apps/api dependency shim.

The shared request-scoped dependencies (``get_db``, ``get_current_user``,
``oauth2_scheme``) live in ``alexandria_core.core.deps`` and are re-exported
here unchanged so existing ``from app.core.deps import ...`` call sites — and
``app.dependency_overrides`` keyed on these exact function objects — keep
working.

``get_model_router`` stays here because it couples to the AI/model-router
service that remains in ``apps/api`` (it moves to ``apps/ai`` in Step 7).
``alexandria_core`` must not depend on ``app.services`` — keeping this here
preserves the one-way ``apps/api`` → ``alexandria_core`` dependency direction.
"""

from alexandria_core.core.deps import (  # noqa: F401 — re-exported for app.* callers
    get_current_user,
    get_db,
    oauth2_scheme,
)

from app.services.model_router import ModelRouter, model_router


def get_model_router() -> ModelRouter:
    return model_router
