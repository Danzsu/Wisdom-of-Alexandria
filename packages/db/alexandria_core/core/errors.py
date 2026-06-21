"""Shared error sanitization helper for the Alexandria backends.

Both services (``apps/api`` domain, ``apps/ai`` AI/RAG) surface internal
exceptions to clients (HTTP detail) or persist them (job ``error_message``).
This is the SINGLE source of the sanitizer — used wherever raw internal text
must be bounded before it leaves the process, so a stack-trace blob, multi-line
provider dump, or anything that might embed a secret can never flood a response,
a log line, or the database as separate lines.
"""

_MAX_ERROR_LEN = 300


def safe_error(exc: Exception | str) -> str:
    """Produce a safe, bounded, single-line error detail.

    Accepts either an exception or a raw message string (so it can sanitize an
    already-extracted ``error_message`` as well as a caught exception).

    - Falls back to the exception class name when ``str(exc)`` is empty.
    - Collapses newlines/tabs/whitespace runs to single spaces so multi-line
      internal dumps cannot bleed into logs or responses as separate lines.
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
