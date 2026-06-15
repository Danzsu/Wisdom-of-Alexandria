"""Integration tests for CodexProgression CRUD."""
import uuid

import pytest
from httpx import AsyncClient


async def test_create_codex_progression(client: AsyncClient, auth_headers: dict):
    char_id = str(uuid.uuid4())

    resp = await client.post(
        "/api/v1/codex-progressions",
        json={
            "entity_type": "character",
            "entity_id": char_id,
            "note": "Character introduced in chapter 1",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["entity_type"] == "character"
    assert data["entity_id"] == char_id
    assert data["note"] == "Character introduced in chapter 1"
    assert data["chapter_id"] is None
    assert data["scene_id"] is None
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


async def test_create_codex_progression_with_chapter_and_scene(
    client: AsyncClient, auth_headers: dict
):
    # Create project, book, chapter, scene for foreign keys
    proj_resp = await client.post(
        "/api/v1/projects",
        json={"title": "Test Project"},
        headers=auth_headers,
    )
    project_id = proj_resp.json()["id"]

    book_resp = await client.post(
        f"/api/v1/projects/{project_id}/books",
        json={"title": "Test Book"},
        headers=auth_headers,
    )
    book_id = book_resp.json()["id"]

    chapter_resp = await client.post(
        f"/api/v1/books/{book_id}/chapters",
        json={"title": "Chapter 1"},
        headers=auth_headers,
    )
    chapter_id = chapter_resp.json()["id"]

    scene_resp = await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes",
        json={"title": "Scene 1"},
        headers=auth_headers,
    )
    scene_id = scene_resp.json()["id"]

    # Create progression with chapter and scene
    char_id = str(uuid.uuid4())
    resp = await client.post(
        "/api/v1/codex-progressions",
        json={
            "entity_type": "character",
            "entity_id": char_id,
            "chapter_id": chapter_id,
            "scene_id": scene_id,
            "note": "Character appears here",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["chapter_id"] == chapter_id
    assert data["scene_id"] == scene_id


async def test_create_codex_progression_requires_auth(client: AsyncClient):
    char_id = str(uuid.uuid4())
    resp = await client.post(
        "/api/v1/codex-progressions",
        json={
            "entity_type": "character",
            "entity_id": char_id,
        },
    )
    assert resp.status_code == 401


async def test_list_codex_progressions_by_entity(client: AsyncClient, auth_headers: dict):
    char_id = str(uuid.uuid4())

    # Create two progressions for the same entity
    await client.post(
        "/api/v1/codex-progressions",
        json={
            "entity_type": "character",
            "entity_id": char_id,
            "note": "First progression",
        },
        headers=auth_headers,
    )

    await client.post(
        "/api/v1/codex-progressions",
        json={
            "entity_type": "character",
            "entity_id": char_id,
            "note": "Second progression",
        },
        headers=auth_headers,
    )

    resp = await client.get(
        f"/api/v1/codex-progressions?entity_type=character&entity_id={char_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert all(p["entity_id"] == char_id for p in data)


async def test_list_codex_progressions_returns_empty_when_no_match(
    client: AsyncClient, auth_headers: dict
):
    char_id = str(uuid.uuid4())

    resp = await client.get(
        f"/api/v1/codex-progressions?entity_type=character&entity_id={char_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 0


async def test_list_codex_progressions_filters_by_entity_type(
    client: AsyncClient, auth_headers: dict
):
    char_id = str(uuid.uuid4())

    # Create progressions of different types with same entity_id
    await client.post(
        "/api/v1/codex-progressions",
        json={
            "entity_type": "character",
            "entity_id": char_id,
        },
        headers=auth_headers,
    )

    await client.post(
        "/api/v1/codex-progressions",
        json={
            "entity_type": "location",
            "entity_id": char_id,  # Same UUID, different type
        },
        headers=auth_headers,
    )

    # Query for character
    resp = await client.get(
        f"/api/v1/codex-progressions?entity_type=character&entity_id={char_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["entity_type"] == "character"


async def test_get_codex_progression_by_id(client: AsyncClient, auth_headers: dict):
    char_id = str(uuid.uuid4())

    create_resp = await client.post(
        "/api/v1/codex-progressions",
        json={
            "entity_type": "character",
            "entity_id": char_id,
            "note": "Test note",
        },
        headers=auth_headers,
    )
    progression_id = create_resp.json()["id"]

    resp = await client.get(
        f"/api/v1/codex-progressions/{progression_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == progression_id
    assert data["entity_type"] == "character"
    assert data["entity_id"] == char_id


async def test_get_codex_progression_not_found(client: AsyncClient, auth_headers: dict):
    fake_id = str(uuid.uuid4())

    resp = await client.get(
        f"/api/v1/codex-progressions/{fake_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_update_codex_progression_note(client: AsyncClient, auth_headers: dict):
    char_id = str(uuid.uuid4())

    create_resp = await client.post(
        "/api/v1/codex-progressions",
        json={
            "entity_type": "character",
            "entity_id": char_id,
            "note": "Original note",
        },
        headers=auth_headers,
    )
    progression_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/api/v1/codex-progressions/{progression_id}",
        json={"note": "Updated note"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["note"] == "Updated note"


async def test_update_codex_progression_chapter_and_scene(
    client: AsyncClient, auth_headers: dict
):
    # Create project, book, chapter, scene for foreign keys
    proj_resp = await client.post(
        "/api/v1/projects",
        json={"title": "Test Project"},
        headers=auth_headers,
    )
    project_id = proj_resp.json()["id"]

    book_resp = await client.post(
        f"/api/v1/projects/{project_id}/books",
        json={"title": "Test Book"},
        headers=auth_headers,
    )
    book_id = book_resp.json()["id"]

    chapter_resp = await client.post(
        f"/api/v1/books/{book_id}/chapters",
        json={"title": "Chapter 1"},
        headers=auth_headers,
    )
    chapter_id = chapter_resp.json()["id"]

    scene_resp = await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes",
        json={"title": "Scene 1"},
        headers=auth_headers,
    )
    scene_id = scene_resp.json()["id"]

    # Create progression without chapter/scene
    char_id = str(uuid.uuid4())
    create_resp = await client.post(
        "/api/v1/codex-progressions",
        json={
            "entity_type": "character",
            "entity_id": char_id,
        },
        headers=auth_headers,
    )
    progression_id = create_resp.json()["id"]

    # Update to add chapter and scene
    resp = await client.patch(
        f"/api/v1/codex-progressions/{progression_id}",
        json={"chapter_id": chapter_id, "scene_id": scene_id},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["chapter_id"] == chapter_id
    assert data["scene_id"] == scene_id


async def test_delete_codex_progression(client: AsyncClient, auth_headers: dict):
    char_id = str(uuid.uuid4())

    create_resp = await client.post(
        "/api/v1/codex-progressions",
        json={
            "entity_type": "character",
            "entity_id": char_id,
            "note": "To delete",
        },
        headers=auth_headers,
    )
    progression_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/api/v1/codex-progressions/{progression_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 204

    # Verify it's deleted
    get_resp = await client.get(
        f"/api/v1/codex-progressions/{progression_id}",
        headers=auth_headers,
    )
    assert get_resp.status_code == 404


async def test_delete_codex_progression_not_found(client: AsyncClient, auth_headers: dict):
    fake_id = str(uuid.uuid4())

    resp = await client.delete(
        f"/api/v1/codex-progressions/{fake_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 404
