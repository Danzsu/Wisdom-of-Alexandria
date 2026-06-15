"""Shared validation for reorder operations.

A reorder request must list EXACTLY the current children once each — same set,
no extras (ids from another parent / typos), no missing ids (which would leave
stale ``order_index`` values and produce duplicate positions). Centralized here
so scenes/beats/chapters can't drift.
"""

import uuid

# Cap on how many ids are listed verbatim in an error message. A pathological
# reorder of a huge collection must not produce an unbounded message (which
# would bloat the 400 response / any log line that records it).
_MAX_IDS_IN_ERROR = 10


def _format_ids(ids: set[uuid.UUID]) -> str:
    """Render a bounded, sorted id list for an error message.

    Lists up to ``_MAX_IDS_IN_ERROR`` ids verbatim, then appends a count of the
    remainder so the message stays bounded regardless of collection size.
    """
    ordered = sorted(str(i) for i in ids)
    shown = ordered[:_MAX_IDS_IN_ERROR]
    rendered = ", ".join(shown)
    extra = len(ordered) - len(shown)
    if extra > 0:
        rendered += f" and {extra} more"
    return rendered


def validate_permutation(
    order: list[uuid.UUID], current_ids: set[uuid.UUID], entity: str
) -> None:
    """Raise ``ValueError`` unless ``order`` is a permutation of ``current_ids``.

    Checks, in order: no duplicates in ``order``; no unknown ids; no missing
    ids. The error messages are safe to surface as a 400 ``detail`` and are
    bounded — at most ``_MAX_IDS_IN_ERROR`` ids are listed, then a "and N more"
    suffix, so a huge reorder cannot produce an unbounded message.
    """
    order_set = set(order)
    if len(order_set) != len(order):
        raise ValueError(f"Reorder list contains duplicate {entity} ids.")
    unknown = order_set - current_ids
    if unknown:
        raise ValueError(
            f"Reorder list contains unknown {entity} ids: {_format_ids(unknown)}"
        )
    missing = current_ids - order_set
    if missing:
        raise ValueError(
            f"Reorder list is missing {entity} ids: {_format_ids(missing)}"
        )
