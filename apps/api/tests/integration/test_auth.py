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


async def test_login_constant_time_comparison_behavior_unchanged(client: AsyncClient):
    """Switching to ``secrets.compare_digest`` must not change observable behavior:
    a wrong password still 401s; the correct credentials still 200 with a token."""
    wrong = await client.post(
        "/api/v1/auth/token",
        data={"username": "admin", "password": "not-the-password"},
    )
    assert wrong.status_code == 401

    right = await client.post(
        "/api/v1/auth/token",
        data={"username": "admin", "password": "changeme"},
    )
    assert right.status_code == 200
    assert right.json()["access_token"]


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
    from alexandria_core.core.security import decode_token
    subject = decode_token(token)
    assert subject == "admin"


async def test_auth_headers_fixture_works(auth_headers: dict[str, str]):
    assert "Authorization" in auth_headers
    assert auth_headers["Authorization"].startswith("Bearer ")


# ── /me: current-user identity ───────────────────────────────────────────────
# Single-user .env auth. /me returns the authenticated username plus a derived
# display_name + initials so the frontend Profil screen can render real identity.


async def test_me_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_me_returns_identity(client: AsyncClient, auth_headers: dict[str, str]):
    resp = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    # Default admin user (from settings.admin_username == "admin").
    assert data["username"] == "admin"
    # display_name is derived from the username (title-cased) when no
    # explicit display-name setting exists.
    assert data["display_name"] == "Admin"
    # initials are the uppercase first letter(s) of the display_name.
    assert data["initials"] == "A"


async def test_me_invalid_token(client: AsyncClient):
    resp = await client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert resp.status_code == 401
