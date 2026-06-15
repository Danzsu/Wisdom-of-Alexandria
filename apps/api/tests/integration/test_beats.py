import uuid
import pytest
from httpx import AsyncClient


async def _setup(client, auth_headers):
    """Create project → book → chapter → scene, return scene_id."""
    proj = (await client.post("/api/v1/projects", json={"title": "P"}, headers=auth_headers)).json()
    book = (await client.post(f"/api/v1/projects/{proj['id']}/books", json={"title": "B"}, headers=auth_headers)).json()
    chapter = (await client.post(f"/api/v1/books/{book['id']}/chapters", json={"title": "Ch"}, headers=auth_headers)).json()
    scene = (await client.post(f"/api/v1/chapters/{chapter['id']}/scenes", json={"title": "S"}, headers=auth_headers)).json()
    return scene["id"]


async def test_create_beat(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    resp = await client.post(
        f"/api/v1/scenes/{scene_id}/beats",
        json={"description": "Első ütés"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["description"] == "Első ütés"
    assert data["beat_type"] is None
    assert data["order_index"] == 0
    assert data["notes"] is None
    assert data["scene_id"] == scene_id


async def test_create_beat_with_all_fields(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    resp = await client.post(
        f"/api/v1/scenes/{scene_id}/beats",
        json={
            "description": "Összecsapás",
            "beat_type": "action",
            "order_index": 1,
            "notes": "Feszült jelenet"
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["description"] == "Összecsapás"
    assert data["beat_type"] == "action"
    assert data["order_index"] == 1
    assert data["notes"] == "Feszült jelenet"


async def test_create_beat_scene_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        f"/api/v1/scenes/{uuid.uuid4()}/beats",
        json={"description": "X"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_create_beat_requires_auth(client: AsyncClient):
    resp = await client.post(
        f"/api/v1/scenes/{uuid.uuid4()}/beats",
        json={"description": "X"}
    )
    assert resp.status_code == 401


async def test_create_beat_empty_description_fails(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    resp = await client.post(
        f"/api/v1/scenes/{scene_id}/beats",
        json={"description": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_list_beats_empty(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    resp = await client.get(f"/api/v1/scenes/{scene_id}/beats", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_list_beats_ordered(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    b1_id = (await client.post(f"/api/v1/scenes/{scene_id}/beats", json={"description": "B1"}, headers=auth_headers)).json()["id"]
    b2_id = (await client.post(f"/api/v1/scenes/{scene_id}/beats", json={"description": "B2", "order_index": 1}, headers=auth_headers)).json()["id"]
    b3_id = (await client.post(f"/api/v1/scenes/{scene_id}/beats", json={"description": "B3", "order_index": 0}, headers=auth_headers)).json()["id"]

    resp = await client.get(f"/api/v1/scenes/{scene_id}/beats", headers=auth_headers)
    assert resp.status_code == 200
    beats = resp.json()
    ids = [b["id"] for b in beats]
    # Should be ordered by order_index, then created_at
    # b3 and b1 both have order_index 0, so b3 (newer) comes last among them
    # Then b2 with order_index 1
    assert beats[0]["order_index"] == 0
    assert beats[1]["order_index"] == 0
    assert beats[2]["order_index"] == 1


async def test_get_beat_by_id(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    beat_id = (await client.post(f"/api/v1/scenes/{scene_id}/beats", json={"description": "Teszt"}, headers=auth_headers)).json()["id"]

    resp = await client.get(f"/api/v1/scenes/{scene_id}/beats/{beat_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == beat_id
    assert data["description"] == "Teszt"


async def test_get_beat_not_found(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    resp = await client.get(f"/api/v1/scenes/{scene_id}/beats/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_get_beat_wrong_scene(client: AsyncClient, auth_headers: dict):
    """Beat belongs to scene A but we request it from scene B"""
    scene_id1 = await _setup(client, auth_headers)
    scene_id2 = await _setup(client, auth_headers)

    beat_id = (await client.post(f"/api/v1/scenes/{scene_id1}/beats", json={"description": "B"}, headers=auth_headers)).json()["id"]

    resp = await client.get(f"/api/v1/scenes/{scene_id2}/beats/{beat_id}", headers=auth_headers)
    assert resp.status_code == 404


async def test_update_beat(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    beat_id = (await client.post(f"/api/v1/scenes/{scene_id}/beats", json={"description": "Old"}, headers=auth_headers)).json()["id"]

    resp = await client.patch(
        f"/api/v1/scenes/{scene_id}/beats/{beat_id}",
        json={"description": "New", "beat_type": "dialogue"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] == "New"
    assert data["beat_type"] == "dialogue"


async def test_update_beat_partial(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    beat_id = (await client.post(
        f"/api/v1/scenes/{scene_id}/beats",
        json={"description": "Teszt", "notes": "Eredeti"},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.patch(
        f"/api/v1/scenes/{scene_id}/beats/{beat_id}",
        json={"beat_type": "action"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] == "Teszt"  # unchanged
    assert data["beat_type"] == "action"
    assert data["notes"] == "Eredeti"  # unchanged


async def test_update_beat_not_found(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    resp = await client.patch(
        f"/api/v1/scenes/{scene_id}/beats/{uuid.uuid4()}",
        json={"description": "X"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_update_beat_empty_description_fails(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    beat_id = (await client.post(f"/api/v1/scenes/{scene_id}/beats", json={"description": "OK"}, headers=auth_headers)).json()["id"]

    resp = await client.patch(
        f"/api/v1/scenes/{scene_id}/beats/{beat_id}",
        json={"description": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_delete_beat(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    beat_id = (await client.post(f"/api/v1/scenes/{scene_id}/beats", json={"description": "Del"}, headers=auth_headers)).json()["id"]

    resp = await client.delete(f"/api/v1/scenes/{scene_id}/beats/{beat_id}", headers=auth_headers)
    assert resp.status_code == 204

    get_resp = await client.get(f"/api/v1/scenes/{scene_id}/beats/{beat_id}", headers=auth_headers)
    assert get_resp.status_code == 404


async def test_delete_beat_not_found(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    resp = await client.delete(f"/api/v1/scenes/{scene_id}/beats/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_reorder_beats(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    b1 = (await client.post(f"/api/v1/scenes/{scene_id}/beats", json={"description": "B1"}, headers=auth_headers)).json()["id"]
    b2 = (await client.post(f"/api/v1/scenes/{scene_id}/beats", json={"description": "B2"}, headers=auth_headers)).json()["id"]
    b3 = (await client.post(f"/api/v1/scenes/{scene_id}/beats", json={"description": "B3"}, headers=auth_headers)).json()["id"]

    resp = await client.post(
        f"/api/v1/scenes/{scene_id}/beats/reorder",
        json={"order": [b3, b1, b2]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    beats = resp.json()
    ids = [b["id"] for b in beats]
    assert ids == [b3, b1, b2]
    assert beats[0]["order_index"] == 0
    assert beats[1]["order_index"] == 1
    assert beats[2]["order_index"] == 2


async def test_reorder_beats_rejects_unknown_id(client: AsyncClient, auth_headers: dict):
    """FIX 5: a non-permutation order is a 400, not a silent drop."""
    scene_id = await _setup(client, auth_headers)
    b1 = (await client.post(f"/api/v1/scenes/{scene_id}/beats", json={"description": "B1"}, headers=auth_headers)).json()["id"]
    b2 = (await client.post(f"/api/v1/scenes/{scene_id}/beats", json={"description": "B2"}, headers=auth_headers)).json()["id"]
    resp = await client.post(
        f"/api/v1/scenes/{scene_id}/beats/reorder",
        json={"order": [b1, b2, str(uuid.uuid4())]},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_reorder_beats_rejects_missing_id(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    b1 = (await client.post(f"/api/v1/scenes/{scene_id}/beats", json={"description": "B1"}, headers=auth_headers)).json()["id"]
    await client.post(f"/api/v1/scenes/{scene_id}/beats", json={"description": "B2"}, headers=auth_headers)
    resp = await client.post(
        f"/api/v1/scenes/{scene_id}/beats/reorder",
        json={"order": [b1]},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_reorder_beats_scene_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        f"/api/v1/scenes/{uuid.uuid4()}/beats/reorder",
        json={"order": []},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_beats_scoped_to_scene(client: AsyncClient, auth_headers: dict):
    """Beats from scene A should not appear in scene B's beat list"""
    scene_id1 = await _setup(client, auth_headers)
    scene_id2 = await _setup(client, auth_headers)

    b1_id = (await client.post(f"/api/v1/scenes/{scene_id1}/beats", json={"description": "Beat1"}, headers=auth_headers)).json()["id"]
    b2_id = (await client.post(f"/api/v1/scenes/{scene_id2}/beats", json={"description": "Beat2"}, headers=auth_headers)).json()["id"]

    resp1 = await client.get(f"/api/v1/scenes/{scene_id1}/beats", headers=auth_headers)
    resp2 = await client.get(f"/api/v1/scenes/{scene_id2}/beats", headers=auth_headers)

    ids1 = [b["id"] for b in resp1.json()]
    ids2 = [b["id"] for b in resp2.json()]

    assert b1_id in ids1
    assert b1_id not in ids2
    assert b2_id not in ids1
    assert b2_id in ids2


async def test_beats_require_auth(client: AsyncClient):
    fake = str(uuid.uuid4())
    for method, url in [
        ("GET", f"/api/v1/scenes/{fake}/beats"),
        ("POST", f"/api/v1/scenes/{fake}/beats"),
        ("GET", f"/api/v1/scenes/{fake}/beats/{fake}"),
        ("PATCH", f"/api/v1/scenes/{fake}/beats/{fake}"),
        ("DELETE", f"/api/v1/scenes/{fake}/beats/{fake}"),
        ("POST", f"/api/v1/scenes/{fake}/beats/reorder"),
    ]:
        resp = await client.request(method, url, json={"description": "x"} if method in ["POST", "PATCH"] else {"order": []})
        assert resp.status_code == 401


async def test_create_beat_beat_type_max_length(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    resp = await client.post(
        f"/api/v1/scenes/{scene_id}/beats",
        json={"description": "Test", "beat_type": "a" * 101},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_create_beat_beat_type_max_length_valid(client: AsyncClient, auth_headers: dict):
    scene_id = await _setup(client, auth_headers)
    resp = await client.post(
        f"/api/v1/scenes/{scene_id}/beats",
        json={"description": "Test", "beat_type": "a" * 100},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["beat_type"] == "a" * 100
