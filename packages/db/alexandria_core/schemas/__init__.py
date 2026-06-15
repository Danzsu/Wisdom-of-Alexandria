"""Shared Pydantic schemas used across more than one Alexandria service.

Only schemas consumed by BOTH ``apps/api`` and ``apps/ai`` live here. Each
service keeps its own service-private schemas in its own ``app.schemas``
package. The dependency direction is one-way: services import from
``alexandria_core``; ``alexandria_core`` never imports a service.
"""

from alexandria_core.schemas.revision import RevisionRead

__all__ = ["RevisionRead"]
