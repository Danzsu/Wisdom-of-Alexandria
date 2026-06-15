import uuid
import pytest
from httpx import AsyncClient


async def _setup(client, auth_headers):
    """Create a project and book, return (project_id, book_id)."""
    proj = await client.post("/api/v1/projects", json={"title": "Proj"}, headers=auth_headers)
    project_id = proj.json()["id"]
    book = await client.post(f"/api/v1/projects/{project_id}/books", json={"title": "Könyv"}, headers=auth_headers)
    book_id = book.json()["id"]
    return project_id, book_id


async def test_create_chapter(client: AsyncClient, auth_headers: dict):
    _, book_id = await _setup(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/chapters",
        json={"title": "Első fejezet"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Első fejezet"
    assert data["book_id"] == book_id
    assert data["status"] == "draft"
    assert data["order_index"] == 0


async def test_create_chapter_with_summary(client: AsyncClient, auth_headers: dict):
    _, book_id = await _setup(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/chapters",
        json={"title": "Fejezet", "summary": "A hős útnak indul."},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["summary"] == "A hős útnak indul."


async def test_create_chapter_with_status(client: AsyncClient, auth_headers: dict):
    _, book_id = await _setup(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/chapters",
        json={"title": "Fejezet", "status": "in_progress"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "in_progress"


async def test_create_chapter_book_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        f"/api/v1/books/{uuid.uuid4()}/chapters",
        json={"title": "X"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_create_chapter_requires_auth(client: AsyncClient):
    resp = await client.post(f"/api/v1/books/{uuid.uuid4()}/chapters", json={"title": "X"})
    assert resp.status_code == 401


async def test_create_chapter_empty_title_fails(client: AsyncClient, auth_headers: dict):
    _, book_id = await _setup(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/chapters",
        json={"title": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_list_chapters_empty(client: AsyncClient, auth_headers: dict):
    _, book_id = await _setup(client, auth_headers)
    resp = await client.get(f"/api/v1/books/{book_id}/chapters", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_chapters_ordered(client: AsyncClient, auth_headers: dict):
    _, book_id = await _setup(client, auth_headers)
    await client.post(f"/api/v1/books/{book_id}/chapters", json={"title": "C", "order_index": 2}, headers=auth_headers)
    await client.post(f"/api/v1/books/{book_id}/chapters", json={"title": "A", "order_index": 0}, headers=auth_headers)
    await client.post(f"/api/v1/books/{book_id}/chapters", json={"title": "B", "order_index": 1}, headers=auth_headers)
    resp = await client.get(f"/api/v1/books/{book_id}/chapters", headers=auth_headers)
    titles = [c["title"] for c in resp.json()]
    assert titles == ["A", "B", "C"]


async def test_list_chapters_book_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.get(f"/api/v1/books/{uuid.uuid4()}/chapters", headers=auth_headers)
    assert resp.status_code == 404


async def test_get_chapter_by_id(client: AsyncClient, auth_headers: dict):
    _, book_id = await _setup(client, auth_headers)
    create_resp = await client.post(f"/api/v1/books/{book_id}/chapters", json={"title": "Konkrét"}, headers=auth_headers)
    chapter_id = create_resp.json()["id"]
    resp = await client.get(f"/api/v1/books/{book_id}/chapters/{chapter_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == chapter_id


async def test_get_chapter_not_found(client: AsyncClient, auth_headers: dict):
    _, book_id = await _setup(client, auth_headers)
    resp = await client.get(f"/api/v1/books/{book_id}/chapters/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_update_chapter(client: AsyncClient, auth_headers: dict):
    _, book_id = await _setup(client, auth_headers)
    create_resp = await client.post(f"/api/v1/books/{book_id}/chapters", json={"title": "Eredeti"}, headers=auth_headers)
    chapter_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/books/{book_id}/chapters/{chapter_id}",
        json={"title": "Frissített", "status": "in_progress"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Frissített"
    assert resp.json()["status"] == "in_progress"


async def test_update_chapter_not_found(client: AsyncClient, auth_headers: dict):
    _, book_id = await _setup(client, auth_headers)
    resp = await client.patch(
        f"/api/v1/books/{book_id}/chapters/{uuid.uuid4()}",
        json={"title": "X"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_delete_chapter(client: AsyncClient, auth_headers: dict):
    _, book_id = await _setup(client, auth_headers)
    create_resp = await client.post(f"/api/v1/books/{book_id}/chapters", json={"title": "Del"}, headers=auth_headers)
    chapter_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/v1/books/{book_id}/chapters/{chapter_id}", headers=auth_headers)
    assert resp.status_code == 204
    get_resp = await client.get(f"/api/v1/books/{book_id}/chapters/{chapter_id}", headers=auth_headers)
    assert get_resp.status_code == 404


async def test_delete_chapter_not_found(client: AsyncClient, auth_headers: dict):
    _, book_id = await _setup(client, auth_headers)
    resp = await client.delete(f"/api/v1/books/{book_id}/chapters/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_reorder_chapters(client: AsyncClient, auth_headers: dict):
    _, book_id = await _setup(client, auth_headers)
    c1 = (await client.post(f"/api/v1/books/{book_id}/chapters", json={"title": "C1", "order_index": 0}, headers=auth_headers)).json()["id"]
    c2 = (await client.post(f"/api/v1/books/{book_id}/chapters", json={"title": "C2", "order_index": 1}, headers=auth_headers)).json()["id"]
    c3 = (await client.post(f"/api/v1/books/{book_id}/chapters", json={"title": "C3", "order_index": 2}, headers=auth_headers)).json()["id"]

    # Reverse order
    resp = await client.post(
        f"/api/v1/books/{book_id}/chapters/reorder",
        json={"order": [c3, c2, c1]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    titles = [c["title"] for c in resp.json()]
    assert titles == ["C3", "C2", "C1"]


async def test_reorder_chapters_book_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        f"/api/v1/books/{uuid.uuid4()}/chapters/reorder",
        json={"order": []},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_reorder_chapters_rejects_unknown_id(client: AsyncClient, auth_headers: dict):
    """FIX 5: a non-permutation order is a 400, not a silent drop."""
    _, book_id = await _setup(client, auth_headers)
    c1 = (await client.post(f"/api/v1/books/{book_id}/chapters", json={"title": "C1"}, headers=auth_headers)).json()["id"]
    c2 = (await client.post(f"/api/v1/books/{book_id}/chapters", json={"title": "C2"}, headers=auth_headers)).json()["id"]
    resp = await client.post(
        f"/api/v1/books/{book_id}/chapters/reorder",
        json={"order": [c1, c2, str(uuid.uuid4())]},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_reorder_chapters_rejects_missing_id(client: AsyncClient, auth_headers: dict):
    _, book_id = await _setup(client, auth_headers)
    c1 = (await client.post(f"/api/v1/books/{book_id}/chapters", json={"title": "C1"}, headers=auth_headers)).json()["id"]
    await client.post(f"/api/v1/books/{book_id}/chapters", json={"title": "C2"}, headers=auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/chapters/reorder",
        json={"order": [c1]},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_create_chapter_rejects_invalid_status(client: AsyncClient, auth_headers: dict):
    """FIX 7: chapter status is enum-validated → 422 for garbage."""
    _, book_id = await _setup(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/chapters",
        json={"title": "Ch", "status": "archived"},  # not a valid Chapter status
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.parametrize("st", ["draft", "in_progress", "complete"])
async def test_create_chapter_accepts_valid_status(client: AsyncClient, auth_headers: dict, st: str):
    _, book_id = await _setup(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/chapters",
        json={"title": "Ch", "status": st},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == st


async def test_chapters_scoped_to_book(client: AsyncClient, auth_headers: dict):
    proj = await client.post("/api/v1/projects", json={"title": "P"}, headers=auth_headers)
    pid = proj.json()["id"]
    b1 = (await client.post(f"/api/v1/projects/{pid}/books", json={"title": "B1"}, headers=auth_headers)).json()["id"]
    b2 = (await client.post(f"/api/v1/projects/{pid}/books", json={"title": "B2"}, headers=auth_headers)).json()["id"]
    await client.post(f"/api/v1/books/{b1}/chapters", json={"title": "B1 Fejezet"}, headers=auth_headers)
    resp = await client.get(f"/api/v1/books/{b2}/chapters", headers=auth_headers)
    assert resp.json() == []


async def test_chapters_requires_auth_all_endpoints(client: AsyncClient):
    fake_book_id = str(uuid.uuid4())
    fake_chapter_id = str(uuid.uuid4())
    endpoints = [
        ("GET", f"/api/v1/books/{fake_book_id}/chapters"),
        ("POST", f"/api/v1/books/{fake_book_id}/chapters"),
        ("GET", f"/api/v1/books/{fake_book_id}/chapters/{fake_chapter_id}"),
        ("PATCH", f"/api/v1/books/{fake_book_id}/chapters/{fake_chapter_id}"),
        ("DELETE", f"/api/v1/books/{fake_book_id}/chapters/{fake_chapter_id}"),
        ("POST", f"/api/v1/books/{fake_book_id}/chapters/reorder"),
    ]
    for method, url in endpoints:
        resp = await client.request(method, url, json={"title": "x"})
        assert resp.status_code == 401, f"{method} {url} should return 401"
