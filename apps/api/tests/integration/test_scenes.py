import uuid
import pytest
from httpx import AsyncClient


async def _setup(client, auth_headers):
    """Create project → book → chapter, return chapter_id."""
    proj = (await client.post("/api/v1/projects", json={"title": "P"}, headers=auth_headers)).json()
    book = (await client.post(f"/api/v1/projects/{proj['id']}/books", json={"title": "B"}, headers=auth_headers)).json()
    chapter = (await client.post(f"/api/v1/books/{book['id']}/chapters", json={"title": "Ch"}, headers=auth_headers)).json()
    return chapter["id"]


async def test_create_scene(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    resp = await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes",
        json={"title": "Első jelenet"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Első jelenet"
    assert data["status"] == "draft"
    assert data["word_count"] == 0
    assert data["chapter_id"] == chapter_id


async def test_create_scene_with_content(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    resp = await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes",
        json={"title": "Jelenet", "content": "A hős belép a szobába."},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["word_count"] == 5


async def test_create_scene_chapter_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(f"/api/v1/chapters/{uuid.uuid4()}/scenes", json={"title": "X"}, headers=auth_headers)
    assert resp.status_code == 404


async def test_create_scene_requires_auth(client: AsyncClient):
    resp = await client.post(f"/api/v1/chapters/{uuid.uuid4()}/scenes", json={"title": "X"})
    assert resp.status_code == 401


async def test_list_scenes_excludes_archived_by_default(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    s1_id = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S1"}, headers=auth_headers)).json()["id"]
    s2_id = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S2"}, headers=auth_headers)).json()["id"]
    await client.post(f"/api/v1/chapters/{chapter_id}/scenes/{s2_id}/archive", headers=auth_headers)
    resp = await client.get(f"/api/v1/chapters/{chapter_id}/scenes", headers=auth_headers)
    assert resp.status_code == 200
    ids = [s["id"] for s in resp.json()]
    assert s1_id in ids
    assert s2_id not in ids


async def test_list_scenes_include_archived(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    s_id = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S"}, headers=auth_headers)).json()["id"]
    await client.post(f"/api/v1/chapters/{chapter_id}/scenes/{s_id}/archive", headers=auth_headers)
    resp = await client.get(f"/api/v1/chapters/{chapter_id}/scenes?include_archived=true", headers=auth_headers)
    ids = [s["id"] for s in resp.json()]
    assert s_id in ids


async def test_get_scene_by_id(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    scene_id = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S"}, headers=auth_headers)).json()["id"]
    resp = await client.get(f"/api/v1/chapters/{chapter_id}/scenes/{scene_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == scene_id


async def test_get_scene_not_found(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    resp = await client.get(f"/api/v1/chapters/{chapter_id}/scenes/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_update_scene_content_updates_word_count(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    scene_id = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S"}, headers=auth_headers)).json()["id"]
    resp = await client.patch(
        f"/api/v1/chapters/{chapter_id}/scenes/{scene_id}",
        json={"content": "Egy két három négy öt hat hét nyolc"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["word_count"] == 8


async def test_update_scene_clears_word_count_on_empty_content(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    scene_id = (await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes",
        json={"title": "S", "content": "Három szó itt"},
        headers=auth_headers,
    )).json()["id"]
    resp = await client.patch(
        f"/api/v1/chapters/{chapter_id}/scenes/{scene_id}",
        json={"content": None},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["word_count"] == 0


async def test_update_scene_not_found(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    resp = await client.patch(f"/api/v1/chapters/{chapter_id}/scenes/{uuid.uuid4()}", json={"title": "X"}, headers=auth_headers)
    assert resp.status_code == 404


async def test_delete_scene(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    scene_id = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "Del"}, headers=auth_headers)).json()["id"]
    resp = await client.delete(f"/api/v1/chapters/{chapter_id}/scenes/{scene_id}", headers=auth_headers)
    assert resp.status_code == 204
    get_resp = await client.get(f"/api/v1/chapters/{chapter_id}/scenes/{scene_id}", headers=auth_headers)
    assert get_resp.status_code == 404


async def test_archive_scene(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    scene_id = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S"}, headers=auth_headers)).json()["id"]
    resp = await client.post(f"/api/v1/chapters/{chapter_id}/scenes/{scene_id}/archive", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "archived"


async def test_unarchive_scene(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    scene_id = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S"}, headers=auth_headers)).json()["id"]
    await client.post(f"/api/v1/chapters/{chapter_id}/scenes/{scene_id}/archive", headers=auth_headers)
    resp = await client.post(f"/api/v1/chapters/{chapter_id}/scenes/{scene_id}/unarchive", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == "draft"


async def test_reorder_scenes(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    s1 = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S1"}, headers=auth_headers)).json()["id"]
    s2 = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S2"}, headers=auth_headers)).json()["id"]
    s3 = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S3"}, headers=auth_headers)).json()["id"]
    resp = await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes/reorder",
        json={"order": [s3, s1, s2]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    ids = [s["id"] for s in resp.json()]
    assert ids == [s3, s1, s2]


async def test_archive_not_found(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    resp = await client.post(f"/api/v1/chapters/{chapter_id}/scenes/{uuid.uuid4()}/archive", headers=auth_headers)
    assert resp.status_code == 404


async def test_scenes_require_auth(client: AsyncClient):
    fake = str(uuid.uuid4())
    for method, url in [
        ("GET", f"/api/v1/chapters/{fake}/scenes"),
        ("POST", f"/api/v1/chapters/{fake}/scenes"),
    ]:
        resp = await client.request(method, url, json={"title": "x"})
        assert resp.status_code == 401
