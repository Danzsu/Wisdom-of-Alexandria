"""Shared error sanitization helpers.

Used wherever an internal exception must be surfaced to a client (HTTP detail)
or persisted (job ``error_message``). The goal is to never leak unbounded raw
internal text — stack-trace-like blobs, multi-line provider dumps, or anything
that might embed a secret — into a response or the database.
"""

_MAX_ERROR_LEN = 300


def safe_error(exc: Exception | str) -> str:
    """Produce a safe, bounded, single-line error detail.

    Accepts either an exception or a raw message string (so it can sanitize an
    already-extracted ``error_message`` as well as a caught exception).

    - Falls back to the exception class name when ``str(exc)`` is empty.
    - Collapses newlines/tabs to spaces so multi-line internal dumps cannot
      bleed into logs or responses as separate lines.
    - Truncates to a fixed maximum length so an attacker-influenced or
      pathologically long message cannot flood the channel.

    This never inspects or echoes credentials; callers must still ensure the
    exception text itself does not embed a secret (the provider layer decrypts
    keys in-memory only and never puts them into exception messages).
    """
    if isinstance(exc, Exception):
        msg = str(exc) or exc.__class__.__name__
    else:
        msg = exc
    # Collapse any whitespace runs (incl. newlines/tabs) into single spaces.
    msg = " ".join(msg.split())
    return msg[:_MAX_ERROR_LEN]
