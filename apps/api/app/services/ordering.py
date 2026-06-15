"""Shared validation for reorder operations.

A reorder request must list EXACTLY the current children once each — same set,
no extras (ids from another parent / typos), no missing ids (which would leave
stale ``order_index`` values and produce duplicate positions). Centralized here
so scenes/beats/chapters can't drift.
"""

import uuid


def validate_permutation(
    order: list[uuid.UUID], current_ids: set[uuid.UUID], entity: str
) -> None:
    """Raise ``ValueError`` unless ``order`` is a permutation of ``current_ids``.

    Checks, in order: no duplicates in ``order``; no unknown ids; no missing
    ids. The error messages are safe to surface as a 400 ``detail``.
    """
    order_set = set(order)
    if len(order_set) != len(order):
        raise ValueError(f"Reorder list contains duplicate {entity} ids.")
    unknown = order_set - current_ids
    if unknown:
        raise ValueError(
            f"Reorder list contains unknown {entity} ids: "
            f"{sorted(str(i) for i in unknown)}"
        )
    missing = current_ids - order_set
    if missing:
        raise ValueError(
            f"Reorder list is missing {entity} ids: "
            f"{sorted(str(i) for i in missing)}"
        )
