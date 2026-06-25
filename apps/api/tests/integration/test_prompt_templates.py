"""Integration tests for the PromptTemplate (Prompt Library) CRUD."""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.crud_prompt_template import (
    BUILTIN_PROMPT_TEMPLATES,
    seed_builtin_prompt_templates,
)


@pytest.fixture
async def seeded(db_session: AsyncSession) -> int:
    """Seed the six builtins into the per-test DB (create_all tier has none)."""
    return await seed_builtin_prompt_templates(db_session)


def _user_payload(**over: object) -> dict:
    base = {
        "name": "Saját prompt",
        "category": "Egyéni",
        "description": "Egy felhasználói prompt.",
        "body": "Csináld ezt: {valami}.",
        "icon_key": "sparkles",
    }
    base.update(over)
    return base


# --- seed ----------------------------------------------------------------


async def test_seed_inserts_six_builtins(seeded: int):
    assert seeded == 6


async def test_seed_is_idempotent(db_session: AsyncSession, seeded: int):
    # Re-running seeds zero new rows.
    again = await seed_builtin_prompt_templates(db_session)
    assert again == 0
    # Trust the table, not just the counter: a dedup regression that drops or
    # duplicates rows while still returning 0 must be caught — exactly 6 remain.
    from sqlalchemy import func, select

    from alexandria_core.models.prompt_template import PromptTemplate

    total = await db_session.scalar(select(func.count()).select_from(PromptTemplate))
    assert total == 6


# --- list ----------------------------------------------------------------


async def test_list_returns_seeded_builtins(
    client: AsyncClient, auth_headers: dict, seeded: int
):
    resp = await client.get("/api/v1/prompt-templates", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 6
    names = {t["name"] for t in data}
    assert names == {spec["name"] for spec in BUILTIN_PROMPT_TEMPLATES}
    for t in data:
        assert t["is_builtin"] is True
        assert t["uses"] == 0
        assert "body" in t and t["body"]
        assert "created_at" in t and "updated_at" in t


async def test_list_requires_auth(
    client: AsyncClient, auth_headers: dict, seeded: int
):
    # GET is gated like every other CRUD router: 401 without a token, 200 with.
    unauth = await client.get("/api/v1/prompt-templates")
    assert unauth.status_code == 401
    ok = await client.get("/api/v1/prompt-templates", headers=auth_headers)
    assert ok.status_code == 200
    assert len(ok.json()) == 6


async def test_get_one_requires_auth(
    client: AsyncClient, auth_headers: dict, seeded: int
):
    listed = (
        await client.get("/api/v1/prompt-templates", headers=auth_headers)
    ).json()
    target_id = listed[0]["id"]
    unauth = await client.get(f"/api/v1/prompt-templates/{target_id}")
    assert unauth.status_code == 401
    ok = await client.get(
        f"/api/v1/prompt-templates/{target_id}", headers=auth_headers
    )
    assert ok.status_code == 200


async def test_list_builtins_before_user_templates(
    client: AsyncClient, auth_headers: dict, seeded: int
):
    create = await client.post(
        "/api/v1/prompt-templates", json=_user_payload(), headers=auth_headers
    )
    assert create.status_code == 201
    resp = await client.get("/api/v1/prompt-templates", headers=auth_headers)
    data = resp.json()
    assert len(data) == 7
    # All builtins come first, then the single user template last.
    assert all(t["is_builtin"] for t in data[:6])
    assert data[6]["is_builtin"] is False
    assert data[6]["name"] == "Saját prompt"


async def test_list_filter_by_category(
    client: AsyncClient, auth_headers: dict, seeded: int
):
    resp = await client.get(
        "/api/v1/prompt-templates?category=Írás", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["category"] == "Írás"


# --- get -----------------------------------------------------------------


async def test_get_one(client: AsyncClient, auth_headers: dict, seeded: int):
    listed = (await client.get("/api/v1/prompt-templates", headers=auth_headers)).json()
    target_id = listed[0]["id"]
    resp = await client.get(
        f"/api/v1/prompt-templates/{target_id}", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == target_id


async def test_get_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        f"/api/v1/prompt-templates/{uuid.uuid4()}", headers=auth_headers
    )
    assert resp.status_code == 404


# --- create --------------------------------------------------------------


async def test_create_user_template(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/prompt-templates", json=_user_payload(), headers=auth_headers
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Saját prompt"
    assert data["is_builtin"] is False
    assert data["uses"] == 0
    assert data["icon_key"] == "sparkles"
    assert "id" in data


async def test_create_ignores_client_is_builtin_and_uses(
    client: AsyncClient, auth_headers: dict
):
    # Even if the client smuggles these, the server forces is_builtin=False/uses=0.
    payload = _user_payload()
    payload["is_builtin"] = True
    payload["uses"] = 999
    resp = await client.post(
        "/api/v1/prompt-templates", json=payload, headers=auth_headers
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["is_builtin"] is False
    assert data["uses"] == 0


async def test_create_requires_auth(client: AsyncClient):
    resp = await client.post("/api/v1/prompt-templates", json=_user_payload())
    assert resp.status_code == 401


async def test_create_overlength_name_422(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/prompt-templates",
        json=_user_payload(name="x" * 256),
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_create_empty_body_422(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/prompt-templates",
        json=_user_payload(body=""),
        headers=auth_headers,
    )
    assert resp.status_code == 422


# --- update --------------------------------------------------------------


async def test_patch_user_template(client: AsyncClient, auth_headers: dict):
    created = (
        await client.post(
            "/api/v1/prompt-templates", json=_user_payload(), headers=auth_headers
        )
    ).json()
    resp = await client.patch(
        f"/api/v1/prompt-templates/{created['id']}",
        json={"name": "Átnevezve", "body": "Új törzs {x}"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Átnevezve"
    assert data["body"] == "Új törzs {x}"
    assert data["category"] == "Egyéni"  # unchanged


async def test_patch_builtin_rejected(
    client: AsyncClient, auth_headers: dict, seeded: int
):
    listed = (await client.get("/api/v1/prompt-templates", headers=auth_headers)).json()
    builtin_id = listed[0]["id"]
    original_name = listed[0]["name"]
    resp = await client.patch(
        f"/api/v1/prompt-templates/{builtin_id}",
        json={"name": "Próba"},
        headers=auth_headers,
    )
    assert resp.status_code == 403
    # The row must NOT have been mutated by the rejected patch.
    after = await client.get(
        f"/api/v1/prompt-templates/{builtin_id}", headers=auth_headers
    )
    assert after.status_code == 200
    assert after.json()["name"] == original_name
    assert after.json()["name"] != "Próba"


async def test_patch_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.patch(
        f"/api/v1/prompt-templates/{uuid.uuid4()}",
        json={"name": "x"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_patch_requires_auth(client: AsyncClient, auth_headers: dict):
    created = (
        await client.post(
            "/api/v1/prompt-templates", json=_user_payload(), headers=auth_headers
        )
    ).json()
    resp = await client.patch(
        f"/api/v1/prompt-templates/{created['id']}", json={"name": "x"}
    )
    assert resp.status_code == 401


# --- delete --------------------------------------------------------------


async def test_delete_user_template(client: AsyncClient, auth_headers: dict):
    created = (
        await client.post(
            "/api/v1/prompt-templates", json=_user_payload(), headers=auth_headers
        )
    ).json()
    resp = await client.delete(
        f"/api/v1/prompt-templates/{created['id']}", headers=auth_headers
    )
    assert resp.status_code == 204
    gone = await client.get(
        f"/api/v1/prompt-templates/{created['id']}", headers=auth_headers
    )
    assert gone.status_code == 404


async def test_delete_builtin_rejected(
    client: AsyncClient, auth_headers: dict, seeded: int
):
    listed = (await client.get("/api/v1/prompt-templates", headers=auth_headers)).json()
    builtin_id = listed[0]["id"]
    resp = await client.delete(
        f"/api/v1/prompt-templates/{builtin_id}", headers=auth_headers
    )
    assert resp.status_code == 403
    # Still there.
    still = await client.get(
        f"/api/v1/prompt-templates/{builtin_id}", headers=auth_headers
    )
    assert still.status_code == 200


async def test_delete_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.delete(
        f"/api/v1/prompt-templates/{uuid.uuid4()}", headers=auth_headers
    )
    assert resp.status_code == 404
