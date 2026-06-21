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


@pytest.mark.integration
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
    # The embedded secret must NOT leak — the catch-all returns a fixed generic
    # body and never echoes the unhandled exception's (attacker-influenceable)
    # message, which could embed a key within the first 300 chars.
    assert "sk-should-not-leak-1234" not in resp.text
    assert "SECRET" not in resp.text
    # No raw internal detail text bleeds through either.
    assert "tracebacky internal detail" not in resp.text


@pytest.mark.integration
async def test_http_exception_not_shadowed(raw_client: AsyncClient):
    """The catch-all must NOT shadow FastAPI's HTTPException handling.

    /jobs/{id} is auth-gated, so an unauthenticated request returns a normal
    401 (FastAPI's HTTPException path) — NOT the 500 catch-all. That proves the
    catch-all only fires for truly unhandled exceptions.
    """
    resp = await raw_client.get(f"/api/v1/jobs/{uuid4()}")
    assert resp.status_code == 401
    assert resp.status_code != 500
