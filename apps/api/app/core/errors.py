"""Shared error sanitization helpers (domain API).

Local copy of the sanitizer used by ``apps/ai`` — duplicated intentionally to
avoid a cross-app import between the two independently-deployable services.
Used wherever an internal exception must be surfaced to a client (HTTP detail):
the goal is to never leak unbounded raw internal text — stack-trace-like blobs,
multi-line dumps, or anything that might embed a secret — into a response.
"""

_MAX_ERROR_LEN = 300


def safe_error(exc: Exception | str) -> str:
    """Produce a safe, bounded, single-line error detail.

    Accepts either an exception or a raw message string.

    - Falls back to the exception class name when ``str(exc)`` is empty.
    - Collapses newlines/tabs/whitespace runs to single spaces so multi-line
      internal dumps cannot bleed into logs or responses as separate lines.
    - Truncates to a fixed maximum length so a pathologically long message
      cannot flood the channel.
    """
    if isinstance(exc, Exception):
        msg = str(exc) or exc.__class__.__name__
    else:
        msg = exc
    msg = " ".join(msg.split())
    return msg[:_MAX_ERROR_LEN]
