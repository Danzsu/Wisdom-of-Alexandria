import uuid

import pytest
from httpx import AsyncClient


async def test_create_project(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/projects",
        json={"title": "Teszt Projekt", "language": "hu"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Teszt Projekt"
    assert data["language"] == "hu"
    assert data["description"] is None
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


async def test_create_project_with_description(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/projects",
        json={"title": "Részletes Projekt", "description": "Egy fantasyregény.", "language": "hu"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["description"] == "Egy fantasyregény."


async def test_create_project_requires_auth(client: AsyncClient):
    resp = await client.post("/api/v1/projects", json={"title": "Projekt"})
    assert resp.status_code == 401


async def test_create_project_empty_title_fails(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/projects",
        json={"title": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_create_project_missing_title_fails(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/projects",
        json={"language": "hu"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_list_projects_empty(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/projects", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_list_projects_returns_created(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/projects", json={"title": "P1"}, headers=auth_headers)
    await client.post("/api/v1/projects", json={"title": "P2"}, headers=auth_headers)
    resp = await client.get("/api/v1/projects", headers=auth_headers)
    assert resp.status_code == 200
    titles = [p["title"] for p in resp.json()]
    assert "P1" in titles
    assert "P2" in titles


async def test_list_projects_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/projects")
    assert resp.status_code == 401


async def test_get_project_by_id(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/projects", json={"title": "Detail Test"}, headers=auth_headers)
    project_id = create_resp.json()["id"]
    resp = await client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == project_id
    assert resp.json()["title"] == "Detail Test"


async def test_get_project_not_found(client: AsyncClient, auth_headers: dict):
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/api/v1/projects/{fake_id}", headers=auth_headers)
    assert resp.status_code == 404


async def test_get_project_requires_auth(client: AsyncClient):
    resp = await client.get(f"/api/v1/projects/{uuid.uuid4()}")
    assert resp.status_code == 401


async def test_update_project_title(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/projects", json={"title": "Original"}, headers=auth_headers)
    project_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/projects/{project_id}",
        json={"title": "Updated"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated"


async def test_update_project_partial(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post(
        "/api/v1/projects",
        json={"title": "Partial", "language": "hu"},
        headers=auth_headers,
    )
    project_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/projects/{project_id}",
        json={"description": "New desc"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Partial"  # unchanged
    assert data["description"] == "New desc"


async def test_update_project_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.patch(
        f"/api/v1/projects/{uuid.uuid4()}",
        json={"title": "X"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_update_project_requires_auth(client: AsyncClient):
    resp = await client.patch(f"/api/v1/projects/{uuid.uuid4()}", json={"title": "X"})
    assert resp.status_code == 401


async def test_delete_project(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/projects", json={"title": "To Delete"}, headers=auth_headers)
    project_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert resp.status_code == 204
    get_resp = await client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert get_resp.status_code == 404


async def test_delete_project_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.delete(f"/api/v1/projects/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_delete_project_requires_auth(client: AsyncClient):
    resp = await client.delete(f"/api/v1/projects/{uuid.uuid4()}")
    assert resp.status_code == 401


async def test_list_projects_pagination(client: AsyncClient, auth_headers: dict):
    for i in range(5):
        await client.post("/api/v1/projects", json={"title": f"Paginalt {i}"}, headers=auth_headers)
    resp = await client.get("/api/v1/projects?limit=2&skip=0", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) <= 2
