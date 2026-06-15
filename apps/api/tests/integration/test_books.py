import uuid

import pytest
from httpx import AsyncClient


async def _create_project(client, auth_headers, title="Test Project"):
    resp = await client.post("/api/v1/projects", json={"title": title}, headers=auth_headers)
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_create_book(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/books",
        json={"title": "Az elveszett királyság", "language": "hu"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Az elveszett királyság"
    assert data["project_id"] == project_id
    assert data["language"] == "hu"
    assert data["order_index"] == 0


async def test_create_book_with_all_fields(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/books",
        json={
            "title": "Teljes könyv",
            "description": "Egy leírás",
            "synopsis": "Szinopszis",
            "genre": "Fantasy",
            "language": "hu",
            "word_count_target": 80000,
            "order_index": 1,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["genre"] == "Fantasy"
    assert data["word_count_target"] == 80000
    assert data["synopsis"] == "Szinopszis"


async def test_create_book_project_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/books",
        json={"title": "Könyv"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_create_book_requires_auth(client: AsyncClient):
    resp = await client.post(f"/api/v1/projects/{uuid.uuid4()}/books", json={"title": "X"})
    assert resp.status_code == 401


async def test_create_book_empty_title_fails(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/books",
        json={"title": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_list_books(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    await client.post(f"/api/v1/projects/{project_id}/books", json={"title": "Könyv 1"}, headers=auth_headers)
    await client.post(f"/api/v1/projects/{project_id}/books", json={"title": "Könyv 2"}, headers=auth_headers)
    resp = await client.get(f"/api/v1/projects/{project_id}/books", headers=auth_headers)
    assert resp.status_code == 200
    titles = [b["title"] for b in resp.json()]
    assert "Könyv 1" in titles
    assert "Könyv 2" in titles


async def test_list_books_empty(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.get(f"/api/v1/projects/{project_id}/books", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_books_scoped_to_project(client: AsyncClient, auth_headers: dict):
    pid1 = await _create_project(client, auth_headers, "Project A")
    pid2 = await _create_project(client, auth_headers, "Project B")
    await client.post(f"/api/v1/projects/{pid1}/books", json={"title": "A könyv"}, headers=auth_headers)
    await client.post(f"/api/v1/projects/{pid2}/books", json={"title": "B könyv"}, headers=auth_headers)
    resp1 = await client.get(f"/api/v1/projects/{pid1}/books", headers=auth_headers)
    assert len(resp1.json()) == 1
    assert resp1.json()[0]["title"] == "A könyv"


async def test_list_books_project_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.get(f"/api/v1/projects/{uuid.uuid4()}/books", headers=auth_headers)
    assert resp.status_code == 404


async def test_get_book_by_id(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    create_resp = await client.post(f"/api/v1/projects/{project_id}/books", json={"title": "Konkrét"}, headers=auth_headers)
    book_id = create_resp.json()["id"]
    resp = await client.get(f"/api/v1/projects/{project_id}/books/{book_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == book_id


async def test_get_book_not_found(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.get(f"/api/v1/projects/{project_id}/books/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_get_book_wrong_project(client: AsyncClient, auth_headers: dict):
    pid1 = await _create_project(client, auth_headers, "P1")
    pid2 = await _create_project(client, auth_headers, "P2")
    create_resp = await client.post(f"/api/v1/projects/{pid1}/books", json={"title": "Könyv"}, headers=auth_headers)
    book_id = create_resp.json()["id"]
    resp = await client.get(f"/api/v1/projects/{pid2}/books/{book_id}", headers=auth_headers)
    assert resp.status_code == 404


async def test_update_book(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    create_resp = await client.post(f"/api/v1/projects/{project_id}/books", json={"title": "Eredeti"}, headers=auth_headers)
    book_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/projects/{project_id}/books/{book_id}",
        json={"title": "Frissített", "genre": "Sci-fi"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Frissített"
    assert resp.json()["genre"] == "Sci-fi"


async def test_update_book_not_found(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.patch(
        f"/api/v1/projects/{project_id}/books/{uuid.uuid4()}",
        json={"title": "X"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_delete_book(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    create_resp = await client.post(f"/api/v1/projects/{project_id}/books", json={"title": "Törlendő"}, headers=auth_headers)
    book_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/v1/projects/{project_id}/books/{book_id}", headers=auth_headers)
    assert resp.status_code == 204
    get_resp = await client.get(f"/api/v1/projects/{project_id}/books/{book_id}", headers=auth_headers)
    assert get_resp.status_code == 404


async def test_delete_book_not_found(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.delete(f"/api/v1/projects/{project_id}/books/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_book_requires_auth_all_endpoints(client: AsyncClient):
    fake_id = str(uuid.uuid4())
    endpoints = [
        ("GET", f"/api/v1/projects/{fake_id}/books"),
        ("POST", f"/api/v1/projects/{fake_id}/books"),
        ("GET", f"/api/v1/projects/{fake_id}/books/{fake_id}"),
        ("PATCH", f"/api/v1/projects/{fake_id}/books/{fake_id}"),
        ("DELETE", f"/api/v1/projects/{fake_id}/books/{fake_id}"),
    ]
    for method, url in endpoints:
        resp = await client.request(method, url, json={"title": "x"})
        assert resp.status_code == 401, f"{method} {url} should return 401"
