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


async def test_create_scene_word_count_strips_markup(client: AsyncClient, auth_headers: dict):
    """FIX 6: word_count is computed over visible text, not raw HTML markup."""
    chapter_id = await _setup(client, auth_headers)
    resp = await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes",
        json={"title": "S", "content": "<p>A hős <strong>belép</strong> a szobába.</p>"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    # "A hős belép a szobába." → 5 words (tags excluded).
    assert resp.json()["word_count"] == 5


async def test_update_scene_word_count_strips_markup(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    scene_id = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S"}, headers=auth_headers)).json()["id"]
    resp = await client.patch(
        f"/api/v1/chapters/{chapter_id}/scenes/{scene_id}",
        json={"content": "<p>egy két</p><p>három</p>"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["word_count"] == 3


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


async def test_reorder_scenes_rejects_unknown_id(client: AsyncClient, auth_headers: dict):
    """FIX 5: a non-permutation order (unknown id) is a 400, not a silent drop."""
    chapter_id = await _setup(client, auth_headers)
    s1 = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S1"}, headers=auth_headers)).json()["id"]
    s2 = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S2"}, headers=auth_headers)).json()["id"]
    resp = await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes/reorder",
        json={"order": [s1, s2, str(uuid.uuid4())]},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    # The original order is untouched (atomic — nothing was renumbered).
    ids = [s["id"] for s in (await client.get(f"/api/v1/chapters/{chapter_id}/scenes", headers=auth_headers)).json()]
    assert ids == [s1, s2]


async def test_reorder_scenes_rejects_missing_id(client: AsyncClient, auth_headers: dict):
    """FIX 5: omitting a child would leave a stale/duplicate order_index → 400."""
    chapter_id = await _setup(client, auth_headers)
    s1 = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S1"}, headers=auth_headers)).json()["id"]
    await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S2"}, headers=auth_headers)
    resp = await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes/reorder",
        json={"order": [s1]},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_reorder_scenes_rejects_duplicate_id(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    s1 = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S1"}, headers=auth_headers)).json()["id"]
    await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S2"}, headers=auth_headers)
    resp = await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes/reorder",
        json={"order": [s1, s1]},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_create_scene_rejects_invalid_status(client: AsyncClient, auth_headers: dict):
    """FIX 7: status is enum-validated → 422 for garbage."""
    chapter_id = await _setup(client, auth_headers)
    resp = await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes",
        json={"title": "S", "status": "not_a_status"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.parametrize("st", ["draft", "in_progress", "complete", "archived"])
async def test_create_scene_accepts_valid_status(client: AsyncClient, auth_headers: dict, st: str):
    chapter_id = await _setup(client, auth_headers)
    resp = await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes",
        json={"title": "S", "status": st},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == st


async def test_update_scene_rejects_invalid_status(client: AsyncClient, auth_headers: dict):
    chapter_id = await _setup(client, auth_headers)
    scene_id = (await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json={"title": "S"}, headers=auth_headers)).json()["id"]
    resp = await client.patch(
        f"/api/v1/chapters/{chapter_id}/scenes/{scene_id}",
        json={"status": "bogus"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


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


# ---------------------------------------------------------------------------
# Scene move (cross-chapter) — POST /scenes/{scene_id}/move (P1.5)
# ---------------------------------------------------------------------------


async def _setup_two_chapters(client, auth_headers):
    """Create project → book → two chapters; return (book_id, ch1_id, ch2_id)."""
    proj = (await client.post("/api/v1/projects", json={"title": "P"}, headers=auth_headers)).json()
    book = (await client.post(f"/api/v1/projects/{proj['id']}/books", json={"title": "B"}, headers=auth_headers)).json()
    ch1 = (await client.post(f"/api/v1/books/{book['id']}/chapters", json={"title": "Ch1"}, headers=auth_headers)).json()
    ch2 = (await client.post(f"/api/v1/books/{book['id']}/chapters", json={"title": "Ch2"}, headers=auth_headers)).json()
    return book["id"], ch1["id"], ch2["id"]


async def _scene(client, auth_headers, chapter_id, title, order_index):
    resp = await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes",
        json={"title": title, "order_index": order_index},
        headers=auth_headers,
    )
    return resp.json()["id"]


async def _order(client, auth_headers, chapter_id):
    """Return [(id, order_index), ...] for a chapter, sorted by order_index."""
    scenes = (await client.get(f"/api/v1/chapters/{chapter_id}/scenes", headers=auth_headers)).json()
    return [(s["id"], s["order_index"]) for s in scenes]


async def test_move_scene_cross_chapter_renumbers_both(client: AsyncClient, auth_headers: dict):
    _book, ch1, ch2 = await _setup_two_chapters(client, auth_headers)
    a = await _scene(client, auth_headers, ch1, "A", 0)
    b = await _scene(client, auth_headers, ch1, "B", 1)
    c = await _scene(client, auth_headers, ch1, "C", 2)
    x = await _scene(client, auth_headers, ch2, "X", 0)
    y = await _scene(client, auth_headers, ch2, "Y", 1)

    # Move B (middle of ch1) into ch2 at index 1 (between X and Y).
    resp = await client.post(
        f"/api/v1/scenes/{b}/move",
        json={"chapter_id": ch2, "order_index": 1},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    moved = resp.json()
    assert moved["chapter_id"] == ch2
    assert moved["id"] == b

    # Source chapter closed the gap densely: A=0, C=1.
    assert await _order(client, auth_headers, ch1) == [(a, 0), (c, 1)]
    # Target chapter made room densely: X=0, B=1, Y=2.
    assert await _order(client, auth_headers, ch2) == [(x, 0), (b, 1), (y, 2)]


async def test_move_scene_target_index_clamped_appends(client: AsyncClient, auth_headers: dict):
    _book, ch1, ch2 = await _setup_two_chapters(client, auth_headers)
    a = await _scene(client, auth_headers, ch1, "A", 0)
    x = await _scene(client, auth_headers, ch2, "X", 0)

    # An out-of-range target index appends at the end of the target chapter.
    resp = await client.post(
        f"/api/v1/scenes/{a}/move",
        json={"chapter_id": ch2, "order_index": 99},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert await _order(client, auth_headers, ch1) == []
    assert await _order(client, auth_headers, ch2) == [(x, 0), (a, 1)]


async def test_move_scene_within_same_chapter_reinserts(client: AsyncClient, auth_headers: dict):
    _book, ch1, _ch2 = await _setup_two_chapters(client, auth_headers)
    a = await _scene(client, auth_headers, ch1, "A", 0)
    b = await _scene(client, auth_headers, ch1, "B", 1)
    c = await _scene(client, auth_headers, ch1, "C", 2)

    # Move A (index 0) to index 2 within the same chapter → B, C, A.
    resp = await client.post(
        f"/api/v1/scenes/{a}/move",
        json={"chapter_id": ch1, "order_index": 2},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["chapter_id"] == ch1
    assert await _order(client, auth_headers, ch1) == [(b, 0), (c, 1), (a, 2)]


async def test_move_scene_to_chapter_in_another_book_rejected(client: AsyncClient, auth_headers: dict):
    _book1, ch1, _ch2 = await _setup_two_chapters(client, auth_headers)
    # A separate book with its own chapter.
    proj2 = (await client.post("/api/v1/projects", json={"title": "P2"}, headers=auth_headers)).json()
    book2 = (await client.post(f"/api/v1/projects/{proj2['id']}/books", json={"title": "B2"}, headers=auth_headers)).json()
    other = (await client.post(f"/api/v1/books/{book2['id']}/chapters", json={"title": "Other"}, headers=auth_headers)).json()
    a = await _scene(client, auth_headers, ch1, "A", 0)

    resp = await client.post(
        f"/api/v1/scenes/{a}/move",
        json={"chapter_id": other["id"], "order_index": 0},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    # The scene did not move: it is still in ch1.
    assert await _order(client, auth_headers, ch1) == [(a, 0)]


async def test_move_scene_not_found(client: AsyncClient, auth_headers: dict):
    _book, _ch1, ch2 = await _setup_two_chapters(client, auth_headers)
    resp = await client.post(
        f"/api/v1/scenes/{uuid.uuid4()}/move",
        json={"chapter_id": ch2, "order_index": 0},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_move_scene_target_chapter_not_found(client: AsyncClient, auth_headers: dict):
    _book, ch1, _ch2 = await _setup_two_chapters(client, auth_headers)
    a = await _scene(client, auth_headers, ch1, "A", 0)
    resp = await client.post(
        f"/api/v1/scenes/{a}/move",
        json={"chapter_id": str(uuid.uuid4()), "order_index": 0},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_move_scene_requires_auth(client: AsyncClient):
    resp = await client.post(
        f"/api/v1/scenes/{uuid.uuid4()}/move",
        json={"chapter_id": str(uuid.uuid4()), "order_index": 0},
    )
    assert resp.status_code == 401
