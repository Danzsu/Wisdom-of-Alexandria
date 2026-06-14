"""Integration tests for Snippet CRUD."""
import uuid
import pytest
from httpx import AsyncClient


async def _create_project(client: AsyncClient, auth_headers: dict) -> str:
    resp = await client.post(
        "/api/v1/projects",
        json={"title": "Test Project"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_create_snippet(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/snippets",
        json={"title": "Első Snippet", "content": "Ez egy rövid szövegrészlet."},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Első Snippet"
    assert data["content"] == "Ez egy rövid szövegrészlet."
    assert data["project_id"] == project_id
    assert data["tags"] == []
    assert data["source_scene_id"] is None
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


async def test_create_snippet_with_source_scene_id(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    scene_id = str(uuid.uuid4())
    resp = await client.post(
        f"/api/v1/projects/{project_id}/snippets",
        json={
            "title": "Jelenetből Mentett",
            "content": "Egy jelenet szövege.",
            "source_scene_id": scene_id,
            "tags": ["jelenet", "minta"],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["source_scene_id"] == scene_id
    assert data["tags"] == ["jelenet", "minta"]


async def test_create_snippet_requires_auth(client: AsyncClient):
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/snippets",
        json={"title": "Snippet", "content": "Tartalom"},
    )
    assert resp.status_code == 401


async def test_create_snippet_project_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/snippets",
        json={"title": "Snippet", "content": "Tartalom"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_list_snippets(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    await client.post(
        f"/api/v1/projects/{project_id}/snippets",
        json={"title": "Snippet A", "content": "Tartalom A"},
        headers=auth_headers,
    )
    await client.post(
        f"/api/v1/projects/{project_id}/snippets",
        json={"title": "Snippet B", "content": "Tartalom B"},
        headers=auth_headers,
    )
    resp = await client.get(
        f"/api/v1/projects/{project_id}/snippets",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    titles = [s["title"] for s in resp.json()]
    assert "Snippet A" in titles
    assert "Snippet B" in titles
    assert len(titles) == 2


async def test_list_snippets_with_tag_filter(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    await client.post(
        f"/api/v1/projects/{project_id}/snippets",
        json={"title": "Párbeszéd", "content": "– Helló!", "tags": ["párbeszéd", "minta"]},
        headers=auth_headers,
    )
    await client.post(
        f"/api/v1/projects/{project_id}/snippets",
        json={"title": "Leírás", "content": "A hegy magas.", "tags": ["leírás"]},
        headers=auth_headers,
    )
    resp = await client.get(
        f"/api/v1/projects/{project_id}/snippets?tag=párbeszéd",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["title"] == "Párbeszéd"


async def test_get_snippet_by_id(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    snippet_id = (await client.post(
        f"/api/v1/projects/{project_id}/snippets",
        json={"title": "Keresett Snippet", "content": "Tartalom"},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.get(
        f"/api/v1/projects/{project_id}/snippets/{snippet_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == snippet_id
    assert resp.json()["title"] == "Keresett Snippet"


async def test_get_snippet_not_found(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.get(
        f"/api/v1/projects/{project_id}/snippets/{uuid.uuid4()}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_update_snippet(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    snippet_id = (await client.post(
        f"/api/v1/projects/{project_id}/snippets",
        json={"title": "Régi Cím", "content": "Régi tartalom", "tags": ["régi"]},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.patch(
        f"/api/v1/projects/{project_id}/snippets/{snippet_id}",
        json={"content": "Frissített tartalom", "tags": ["frissített", "új"]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Régi Cím"  # unchanged
    assert data["content"] == "Frissített tartalom"
    assert data["tags"] == ["frissített", "új"]


async def test_delete_snippet(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    snippet_id = (await client.post(
        f"/api/v1/projects/{project_id}/snippets",
        json={"title": "Törlendő Snippet", "content": "Tartalom"},
        headers=auth_headers,
    )).json()["id"]

    del_resp = await client.delete(
        f"/api/v1/projects/{project_id}/snippets/{snippet_id}",
        headers=auth_headers,
    )
    assert del_resp.status_code == 204

    get_resp = await client.get(
        f"/api/v1/projects/{project_id}/snippets/{snippet_id}",
        headers=auth_headers,
    )
    assert get_resp.status_code == 404


async def test_delete_snippet_not_found(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.delete(
        f"/api/v1/projects/{project_id}/snippets/{uuid.uuid4()}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_snippet_scoped_to_project(client: AsyncClient, auth_headers: dict):
    project_id_1 = await _create_project(client, auth_headers)
    project_id_2 = await _create_project(client, auth_headers)
    snippet_id = (await client.post(
        f"/api/v1/projects/{project_id_1}/snippets",
        json={"title": "Projekt 1 Snippet", "content": "Tartalom"},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.get(
        f"/api/v1/projects/{project_id_2}/snippets/{snippet_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 404
