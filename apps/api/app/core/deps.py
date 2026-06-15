"""apps/api dependency shim.

The shared request-scoped dependencies (``get_db``, ``get_current_user``,
``oauth2_scheme``) live in ``alexandria_core.core.deps`` and are re-exported
here unchanged so existing ``from app.core.deps import ...`` call sites — and
``app.dependency_overrides`` keyed on these exact function objects — keep
working.

The AI/model-router dependency (``get_model_router``) moved to ``apps/ai``
together with the AI services in Step 7. This service is domain-CRUD-only and
no longer references the model router; the one-way ``apps/api`` →
``alexandria_core`` dependency direction is preserved.
"""

from alexandria_core.core.deps import (  # noqa: F401 — re-exported for app.* callers
    get_current_user,
    get_db,
    oauth2_scheme,
)
