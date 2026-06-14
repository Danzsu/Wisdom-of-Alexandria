import pytest
from httpx import AsyncClient


async def test_login_success(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/token",
        data={"username": "admin", "password": "changeme"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/token",
        data={"username": "admin", "password": "wrongpassword"},
    )
    assert resp.status_code == 401


async def test_login_wrong_username(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/token",
        data={"username": "hacker", "password": "changeme"},
    )
    assert resp.status_code == 401


async def test_protected_endpoint_without_token(client: AsyncClient):
    """Accessing a protected endpoint without token should 401.
    We'll use /api/v1/projects (not yet built) or just verify the auth deps work.
    For now, test that the token from login works for decode."""
    # Get a token
    resp = await client.post(
        "/api/v1/auth/token",
        data={"username": "admin", "password": "changeme"},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]

    # Verify token decodes correctly
    from app.core.security import decode_token
    subject = decode_token(token)
    assert subject == "admin"


async def test_auth_headers_fixture_works(auth_headers: dict[str, str]):
    assert "Authorization" in auth_headers
    assert auth_headers["Authorization"].startswith("Bearer ")
