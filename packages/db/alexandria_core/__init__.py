"""alexandria_core — shared SQLAlchemy models, DB session, config, security, deps.

This package is the single source of truth for the persistence layer and is
consumed by ``apps/api`` (and, from Step 7 onward, ``apps/ai``). Importing this
package eagerly registers every ORM model on ``Base.metadata`` so Alembic and
``Base.metadata.create_all`` see the full schema.
"""

from alexandria_core import models as models  # noqa: F401 — register all models
from alexandria_core.models.base import Base  # noqa: F401

# Convenience alias for Alembic / test bootstrapping.
target_metadata = Base.metadata

__all__ = ["Base", "models", "target_metadata"]
