"""Bounded upload reading (P1 — OOM guard).

``UploadFile.read()`` with no argument reads the ENTIRE request body into RAM at
once, so an authenticated client can OOM the worker with a huge body BEFORE any
size cap is checked. :func:`read_upload_capped` instead reads in bounded chunks,
accumulating into a buffer, and aborts with HTTP 413 the moment the accumulated
size exceeds the cap — so an oversize body is never fully buffered.
"""

from typing import Protocol

from fastapi import HTTPException, status

#: Default streaming chunk size (1 MiB). Small enough that the over-cap abort
#: wastes at most one chunk of RAM beyond the cap, large enough to stay efficient.
DEFAULT_CHUNK_SIZE = 1024 * 1024


class _Readable(Protocol):
    async def read(self, size: int = -1) -> bytes: ...


async def read_upload_capped(
    file: _Readable,
    *,
    max_bytes: int,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
) -> bytes:
    """Read an upload into memory in bounded chunks, capping the total size.

    Reads ``chunk_size`` bytes at a time. The moment the accumulated size exceeds
    ``max_bytes`` the read ABORTS with HTTP 413 — the whole oversize body is never
    buffered (at most ``max_bytes + chunk_size`` bytes are ever held). A body at
    or under the cap is returned in full.
    """
    buffer = bytearray()
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        buffer.extend(chunk)
        if len(buffer) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    "The uploaded file is too large "
                    f"(limit {max_bytes // (1024 * 1024)} MB)."
                ),
            )
    return bytes(buffer)
