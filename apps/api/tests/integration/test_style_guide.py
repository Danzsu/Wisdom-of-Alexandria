"""Integration tests for StyleGuide CRUD."""
import uuid

from httpx import AsyncClient


async def _create_project(client: AsyncClient, auth_headers: dict) -> str:
    resp = await client.post(
        "/api/v1/projects",
        json={"title": "Test Project"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_create_style_guide(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/style-guide",
        json={
            "tone": "Komoly, drámai",
            "pov": "harmadik személy",
            "tense": "múlt idő",
            "rules": {"kerüld": "passzív szerkezeteket"},
            "examples": {"jó": "Elment."},
            "notes": "Magyar regénystílus",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["project_id"] == project_id
    assert data["tone"] == "Komoly, drámai"
    assert data["pov"] == "harmadik személy"
    assert data["tense"] == "múlt idő"
    assert data["rules"] == {"kerüld": "passzív szerkezeteket"}
    assert data["examples"] == {"jó": "Elment."}
    assert data["notes"] == "Magyar regénystílus"
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


async def test_create_style_guide_duplicate_returns_409(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    await client.post(
        f"/api/v1/projects/{project_id}/style-guide",
        json={"tone": "Első"},
        headers=auth_headers,
    )
    resp = await client.post(
        f"/api/v1/projects/{project_id}/style-guide",
        json={"tone": "Második"},
        headers=auth_headers,
    )
    assert resp.status_code == 409


async def test_create_style_guide_requires_auth(client: AsyncClient):
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/style-guide",
        json={"tone": "Komoly"},
    )
    assert resp.status_code == 401


async def test_create_style_guide_project_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/style-guide",
        json={"tone": "Komoly"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_get_style_guide(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    await client.post(
        f"/api/v1/projects/{project_id}/style-guide",
        json={"tone": "Lírai", "pov": "első személy"},
        headers=auth_headers,
    )
    resp = await client.get(
        f"/api/v1/projects/{project_id}/style-guide",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["tone"] == "Lírai"
    assert data["pov"] == "első személy"
    assert data["project_id"] == project_id


async def test_get_style_guide_not_found(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.get(
        f"/api/v1/projects/{project_id}/style-guide",
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_upsert_creates_when_none_exists(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.put(
        f"/api/v1/projects/{project_id}/style-guide",
        json={"tone": "Epikus", "tense": "jelen idő"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["tone"] == "Epikus"
    assert data["tense"] == "jelen idő"
    assert data["project_id"] == project_id


async def test_upsert_updates_when_exists(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    # First create
    await client.post(
        f"/api/v1/projects/{project_id}/style-guide",
        json={"tone": "Eredeti tónus", "pov": "harmadik személy"},
        headers=auth_headers,
    )
    # Then upsert (full replace)
    resp = await client.put(
        f"/api/v1/projects/{project_id}/style-guide",
        json={"tone": "Új tónus"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["tone"] == "Új tónus"
    # pov is reset because PUT is a full replace
    assert data["pov"] is None


async def test_patch_style_guide(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    await client.post(
        f"/api/v1/projects/{project_id}/style-guide",
        json={"tone": "Komoly", "pov": "harmadik személy", "tense": "múlt idő"},
        headers=auth_headers,
    )
    resp = await client.patch(
        f"/api/v1/projects/{project_id}/style-guide",
        json={"tone": "Ironikus"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["tone"] == "Ironikus"
    # Other fields should remain unchanged
    assert data["pov"] == "harmadik személy"
    assert data["tense"] == "múlt idő"


async def test_patch_style_guide_not_found(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.patch(
        f"/api/v1/projects/{project_id}/style-guide",
        json={"tone": "Bármilyen"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_delete_style_guide(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    await client.post(
        f"/api/v1/projects/{project_id}/style-guide",
        json={"tone": "Törlendő"},
        headers=auth_headers,
    )
    del_resp = await client.delete(
        f"/api/v1/projects/{project_id}/style-guide",
        headers=auth_headers,
    )
    assert del_resp.status_code == 204

    get_resp = await client.get(
        f"/api/v1/projects/{project_id}/style-guide",
        headers=auth_headers,
    )
    assert get_resp.status_code == 404


async def test_delete_style_guide_not_found(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.delete(
        f"/api/v1/projects/{project_id}/style-guide",
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_style_guide_all_fields_null_by_default(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/style-guide",
        json={},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["tone"] is None
    assert data["pov"] is None
    assert data["tense"] is None
    assert data["rules"] is None
    assert data["examples"] is None
    assert data["notes"] is None
