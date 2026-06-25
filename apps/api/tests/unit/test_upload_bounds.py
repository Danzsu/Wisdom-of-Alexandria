"""Bounded upload reading (P1 — OOM guard).

``read_upload_capped`` must read an UploadFile in bounded chunks and ABORT with
HTTP 413 the moment the accumulated size exceeds the cap — BEFORE the whole body
is buffered into RAM. The test uses a fake UploadFile that yields a fixed number
of chunks and records how many bytes it was asked to read, then asserts the
helper stopped early (never buffered the whole oversize body) and raised 413.
"""

import pytest
from fastapi import HTTPException

from app.core.uploads import read_upload_capped


class _SpyUpload:
    """Minimal UploadFile stand-in: yields ``total`` bytes in ``chunk``-sized
    pieces and tracks the cumulative bytes actually handed out."""

    def __init__(self, total: int, chunk: int):
        self._remaining = total
        self._chunk = chunk
        self.bytes_read = 0
        self.read_calls = 0

    async def read(self, size: int = -1) -> bytes:
        self.read_calls += 1
        n = self._chunk if size in (-1, 0) else min(size, self._chunk)
        n = min(n, self._remaining)
        self._remaining -= n
        self.bytes_read += n
        return b"x" * n


async def test_capped_read_aborts_early_with_413():
    cap = 1000
    chunk = 100
    # An oversize body: 100 chunks of 100 bytes = 10_000 bytes, 10x the cap.
    spy = _SpyUpload(total=10_000, chunk=chunk)

    with pytest.raises(HTTPException) as exc_info:
        await read_upload_capped(spy, max_bytes=cap, chunk_size=chunk)

    assert exc_info.value.status_code == 413
    # CRITICAL: it must NOT have buffered the whole body. Reading stops as soon as
    # the accumulated size exceeds the cap — at most cap + one chunk.
    assert spy.bytes_read <= cap + chunk
    # And far less than the full 10_000-byte body.
    assert spy.bytes_read < 10_000


async def test_capped_read_returns_body_under_cap():
    cap = 1000
    chunk = 100
    spy = _SpyUpload(total=500, chunk=chunk)
    data = await read_upload_capped(spy, max_bytes=cap, chunk_size=chunk)
    assert data == b"x" * 500
    assert spy.bytes_read == 500


async def test_capped_read_allows_exactly_cap():
    cap = 1000
    chunk = 100
    spy = _SpyUpload(total=1000, chunk=chunk)
    data = await read_upload_capped(spy, max_bytes=cap, chunk_size=chunk)
    assert len(data) == 1000


async def test_capped_read_one_over_cap_is_413():
    cap = 1000
    chunk = 100
    spy = _SpyUpload(total=1001, chunk=chunk)
    with pytest.raises(HTTPException) as exc_info:
        await read_upload_capped(spy, max_bytes=cap, chunk_size=chunk)
    assert exc_info.value.status_code == 413
