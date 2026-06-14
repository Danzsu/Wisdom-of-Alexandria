"""Integration tests for CodexRelation CRUD."""
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


async def test_create_codex_relation(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    char_id = str(uuid.uuid4())
    loc_id = str(uuid.uuid4())

    resp = await client.post(
        f"/api/v1/projects/{project_id}/codex-relations",
        json={
            "from_entity_type": "character",
            "from_entity_id": char_id,
            "to_entity_type": "location",
            "to_entity_id": loc_id,
            "relation_type": "located_at",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["project_id"] == project_id
    assert data["from_entity_type"] == "character"
    assert data["from_entity_id"] == char_id
    assert data["to_entity_type"] == "location"
    assert data["to_entity_id"] == loc_id
    assert data["relation_type"] == "located_at"
    assert data["description"] is None
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


async def test_create_codex_relation_with_description(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    char_id = str(uuid.uuid4())
    char_id2 = str(uuid.uuid4())

    resp = await client.post(
        f"/api/v1/projects/{project_id}/codex-relations",
        json={
            "from_entity_type": "character",
            "from_entity_id": char_id,
            "to_entity_type": "character",
            "to_entity_id": char_id2,
            "relation_type": "enemy_of",
            "description": "Ősi ellenséges viszony",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["description"] == "Ősi ellenséges viszony"


async def test_create_codex_relation_project_not_found(client: AsyncClient, auth_headers: dict):
    fake_project_id = str(uuid.uuid4())
    resp = await client.post(
        f"/api/v1/projects/{fake_project_id}/codex-relations",
        json={
            "from_entity_type": "character",
            "from_entity_id": str(uuid.uuid4()),
            "to_entity_type": "location",
            "to_entity_id": str(uuid.uuid4()),
            "relation_type": "located_at",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_create_codex_relation_requires_auth(client: AsyncClient):
    project_id = str(uuid.uuid4())
    resp = await client.post(
        f"/api/v1/projects/{project_id}/codex-relations",
        json={
            "from_entity_type": "character",
            "from_entity_id": str(uuid.uuid4()),
            "to_entity_type": "location",
            "to_entity_id": str(uuid.uuid4()),
            "relation_type": "located_at",
        },
    )
    assert resp.status_code == 401


async def test_list_codex_relations(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)

    # Create two relations
    char_id = str(uuid.uuid4())
    loc_id = str(uuid.uuid4())
    char_id2 = str(uuid.uuid4())

    await client.post(
        f"/api/v1/projects/{project_id}/codex-relations",
        json={
            "from_entity_type": "character",
            "from_entity_id": char_id,
            "to_entity_type": "location",
            "to_entity_id": loc_id,
            "relation_type": "located_at",
        },
        headers=auth_headers,
    )

    await client.post(
        f"/api/v1/projects/{project_id}/codex-relations",
        json={
            "from_entity_type": "character",
            "from_entity_id": char_id,
            "to_entity_type": "character",
            "to_entity_id": char_id2,
            "relation_type": "ally_of",
        },
        headers=auth_headers,
    )

    resp = await client.get(
        f"/api/v1/projects/{project_id}/codex-relations",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2


async def test_list_codex_relations_scoped_to_project(client: AsyncClient, auth_headers: dict):
    project_id_1 = await _create_project(client, auth_headers)
    project_id_2 = await _create_project(client, auth_headers)

    # Create relation in project 1
    char_id = str(uuid.uuid4())
    loc_id = str(uuid.uuid4())

    await client.post(
        f"/api/v1/projects/{project_id_1}/codex-relations",
        json={
            "from_entity_type": "character",
            "from_entity_id": char_id,
            "to_entity_type": "location",
            "to_entity_id": loc_id,
            "relation_type": "located_at",
        },
        headers=auth_headers,
    )

    # List from project 2 - should be empty
    resp = await client.get(
        f"/api/v1/projects/{project_id_2}/codex-relations",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 0


async def test_get_codex_relation_by_id(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    char_id = str(uuid.uuid4())
    loc_id = str(uuid.uuid4())

    create_resp = await client.post(
        f"/api/v1/projects/{project_id}/codex-relations",
        json={
            "from_entity_type": "character",
            "from_entity_id": char_id,
            "to_entity_type": "location",
            "to_entity_id": loc_id,
            "relation_type": "located_at",
        },
        headers=auth_headers,
    )
    relation_id = create_resp.json()["id"]

    resp = await client.get(
        f"/api/v1/projects/{project_id}/codex-relations/{relation_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == relation_id
    assert data["relation_type"] == "located_at"


async def test_get_codex_relation_not_found(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    fake_id = str(uuid.uuid4())

    resp = await client.get(
        f"/api/v1/projects/{project_id}/codex-relations/{fake_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_update_codex_relation_type(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    char_id = str(uuid.uuid4())
    char_id2 = str(uuid.uuid4())

    create_resp = await client.post(
        f"/api/v1/projects/{project_id}/codex-relations",
        json={
            "from_entity_type": "character",
            "from_entity_id": char_id,
            "to_entity_type": "character",
            "to_entity_id": char_id2,
            "relation_type": "enemy_of",
        },
        headers=auth_headers,
    )
    relation_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/projects/{project_id}/codex-relations/{relation_id}",
        json={"relation_type": "ally_of"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["relation_type"] == "ally_of"


async def test_update_codex_relation_description(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    char_id = str(uuid.uuid4())
    loc_id = str(uuid.uuid4())

    create_resp = await client.post(
        f"/api/v1/projects/{project_id}/codex-relations",
        json={
            "from_entity_type": "character",
            "from_entity_id": char_id,
            "to_entity_type": "location",
            "to_entity_id": loc_id,
            "relation_type": "located_at",
        },
        headers=auth_headers,
    )
    relation_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/projects/{project_id}/codex-relations/{relation_id}",
        json={"description": "Új leírás"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] == "Új leírás"


async def test_delete_codex_relation(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    char_id = str(uuid.uuid4())
    loc_id = str(uuid.uuid4())

    create_resp = await client.post(
        f"/api/v1/projects/{project_id}/codex-relations",
        json={
            "from_entity_type": "character",
            "from_entity_id": char_id,
            "to_entity_type": "location",
            "to_entity_id": loc_id,
            "relation_type": "located_at",
        },
        headers=auth_headers,
    )
    relation_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/api/v1/projects/{project_id}/codex-relations/{relation_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 204

    # Verify it's deleted
    get_resp = await client.get(
        f"/api/v1/projects/{project_id}/codex-relations/{relation_id}",
        headers=auth_headers,
    )
    assert get_resp.status_code == 404


async def test_delete_codex_relation_not_found(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    fake_id = str(uuid.uuid4())

    resp = await client.delete(
        f"/api/v1/projects/{project_id}/codex-relations/{fake_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 404
