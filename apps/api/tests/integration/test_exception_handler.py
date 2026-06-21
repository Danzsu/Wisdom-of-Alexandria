"""A2 regression: the global catch-all exception handler returns a sanitized
500 and never leaks a traceback / raw internal text / secret, while leaving
FastAPI's HTTPException + validation handling untouched.

A test-only route is mounted on the real app to force an unhandled Exception.
``raise_server_exceptions=False`` lets the transport surface the handler's
response instead of re-raising the exception into the test.
"""

from uuid import uuid4

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app

# A multi-line message embedding a fake secret + a long tail. The sanitized
# response must contain NONE of the newlines and must be bounded.
_RAW = "tracebacky internal detail\nSECRET=sk-should-not-leak-1234\n" + ("x" * 5000)


@app.get("/_test_boom", include_in_schema=False)
async def _boom() -> dict:  # pragma: no cover - invoked via the test client
    raise RuntimeError(_RAW)


@pytest.fixture
async def raw_client():
    # raise_app_exceptions=False lets the transport surface the registered
    # exception handler's 500 response instead of re-raising into the test.
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


async def test_unhandled_exception_returns_sanitized_500(raw_client: AsyncClient):
    resp = await raw_client.get("/_test_boom")
    assert resp.status_code == 500
    body = resp.json()
    detail = body["detail"]
    # Bounded + single-line + no secret/traceback bleed.
    assert isinstance(detail, str)
    assert len(detail) <= 300
    assert "\n" not in detail
    assert "\r" not in detail
    # The whole 5000-char tail cannot have survived truncation.
    assert "x" * 400 not in resp.text
    # The CRITICAL assertion: the embedded secret (in the FIRST chars of the
    # exception message, where truncation alone would NOT strip it) must never
    # reach the client. The catch-all returns a generic message, not str(exc).
    assert "SECRET=" not in resp.text
    assert "sk-should-not-leak" not in resp.text
    assert "tracebacky internal detail" not in resp.text
    assert detail == "Internal server error"


async def test_http_exception_not_shadowed(raw_client: AsyncClient):
    """The catch-all must NOT shadow FastAPI's HTTPException handling.

    /projects/{id} is auth-gated, so an unauthenticated request returns a normal
    401 (FastAPI's HTTPException path) — NOT the 500 catch-all. That proves the
    catch-all only fires for truly unhandled exceptions.
    """
    resp = await raw_client.get(f"/api/v1/projects/{uuid4()}")
    assert resp.status_code == 401
    assert resp.status_code != 500
