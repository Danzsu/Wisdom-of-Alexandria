"""Integration tests for Revision endpoints."""
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


async def _setup_scene(client: AsyncClient, auth_headers: dict) -> tuple[str, str]:
    """Create project → book → chapter → scene, return (chapter_id, scene_id)."""
    proj = (await client.post("/api/v1/projects", json={"title": "P"}, headers=auth_headers)).json()
    book = (await client.post(f"/api/v1/projects/{proj['id']}/books", json={"title": "B"}, headers=auth_headers)).json()
    ch = (await client.post(f"/api/v1/books/{book['id']}/chapters", json={"title": "Ch"}, headers=auth_headers)).json()
    scene = (await client.post(f"/api/v1/chapters/{ch['id']}/scenes", json={"title": "S"}, headers=auth_headers)).json()
    return ch["id"], scene["id"]


async def test_list_revisions_requires_scene_id(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/revisions", headers=auth_headers)
    assert resp.status_code == 400


async def test_list_revisions_requires_auth(client: AsyncClient):
    resp = await client.get(f"/api/v1/revisions?scene_id={uuid.uuid4()}")
    assert resp.status_code == 401


async def test_list_revisions_empty(client: AsyncClient, auth_headers: dict):
    _, scene_id = await _setup_scene(client, auth_headers)
    resp = await client.get(f"/api/v1/revisions?scene_id={scene_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


async def test_get_revision_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.get(f"/api/v1/revisions/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_get_revision_requires_auth(client: AsyncClient):
    resp = await client.get(f"/api/v1/revisions/{uuid.uuid4()}")
    assert resp.status_code == 401


async def test_approve_revision_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(f"/api/v1/revisions/{uuid.uuid4()}/approve", headers=auth_headers)
    assert resp.status_code == 404


async def test_reject_revision_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(f"/api/v1/revisions/{uuid.uuid4()}/reject", headers=auth_headers)
    assert resp.status_code == 404


async def test_list_revisions_returns_created_revision(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    from alexandria_core.models.revision import Revision

    _, scene_id = await _setup_scene(client, auth_headers)

    rev = Revision(
        scene_id=uuid.UUID(scene_id),
        content="Teszt tartalom.",
        approved=False,
        revision_type="rewrite",
    )
    db_session.add(rev)
    await db_session.commit()

    resp = await client.get(f"/api/v1/revisions?scene_id={scene_id}", headers=auth_headers)
    assert resp.status_code == 200
    ids = [r["id"] for r in resp.json()]
    assert str(rev.id) in ids


async def test_get_revision_by_id(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    from alexandria_core.models.revision import Revision

    _, scene_id = await _setup_scene(client, auth_headers)

    rev = Revision(
        scene_id=uuid.UUID(scene_id),
        content="Konkrét tartalom.",
        approved=False,
        revision_type="generate_scene",
        model_name="ollama/llama3",
    )
    db_session.add(rev)
    await db_session.commit()

    resp = await client.get(f"/api/v1/revisions/{rev.id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(rev.id)
    assert data["content"] == "Konkrét tartalom."
    assert data["approved"] is False
    assert data["revision_type"] == "generate_scene"
    assert data["model_name"] == "ollama/llama3"


async def test_approve_revision_updates_scene(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    from alexandria_core.models.revision import Revision

    chapter_id, scene_id = await _setup_scene(client, auth_headers)

    rev = Revision(
        scene_id=uuid.UUID(scene_id),
        content="Ez az új tartalom öt szóval.",
        approved=False,
        revision_type="rewrite",
    )
    db_session.add(rev)
    await db_session.commit()

    resp = await client.post(f"/api/v1/revisions/{rev.id}/approve", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["approved"] is True

    scene_resp = await client.get(
        f"/api/v1/chapters/{chapter_id}/scenes/{scene_id}", headers=auth_headers
    )
    assert scene_resp.status_code == 200
    scene_data = scene_resp.json()
    assert scene_data["content"] == "Ez az új tartalom öt szóval."
    assert scene_data["word_count"] == 6


async def test_approve_revision_word_count_strips_markup(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    """FIX 6: approving a rich-text revision counts visible words, not tags."""
    from alexandria_core.models.revision import Revision

    chapter_id, scene_id = await _setup_scene(client, auth_headers)

    rev = Revision(
        scene_id=uuid.UUID(scene_id),
        content="<p>A hős <em>belép</em> a szobába.</p>",
        approved=False,
        revision_type="generate_scene",
    )
    db_session.add(rev)
    await db_session.commit()

    resp = await client.post(f"/api/v1/revisions/{rev.id}/approve", headers=auth_headers)
    assert resp.status_code == 200

    scene_resp = await client.get(
        f"/api/v1/chapters/{chapter_id}/scenes/{scene_id}", headers=auth_headers
    )
    # "A hős belép a szobába." → 5 words, tags excluded.
    assert scene_resp.json()["word_count"] == 5


async def test_approve_revision_without_scene_id(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    """Approving a revision with no scene_id should still succeed without errors."""
    from alexandria_core.models.revision import Revision

    rev = Revision(
        scene_id=None,
        content="Tartalom scene nélkül.",
        approved=False,
        revision_type="describe_channel",
    )
    db_session.add(rev)
    await db_session.commit()

    resp = await client.post(f"/api/v1/revisions/{rev.id}/approve", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["approved"] is True


async def test_reject_revision(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    from alexandria_core.models.revision import Revision

    _, scene_id = await _setup_scene(client, auth_headers)

    rev = Revision(
        scene_id=uuid.UUID(scene_id),
        content="Elutasítandó tartalom.",
        approved=True,  # start as approved
        revision_type="rewrite",
    )
    db_session.add(rev)
    await db_session.commit()

    resp = await client.post(f"/api/v1/revisions/{rev.id}/reject", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["approved"] is False


async def test_reject_revision_already_false(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    """Rejecting an already-rejected revision is a no-op."""
    from alexandria_core.models.revision import Revision

    _, scene_id = await _setup_scene(client, auth_headers)

    rev = Revision(
        scene_id=uuid.UUID(scene_id),
        content="Már elutasított.",
        approved=False,
        revision_type="rewrite",
    )
    db_session.add(rev)
    await db_session.commit()

    resp = await client.post(f"/api/v1/revisions/{rev.id}/reject", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["approved"] is False


async def test_revision_schema_fields(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    from alexandria_core.models.revision import Revision

    _, scene_id = await _setup_scene(client, auth_headers)

    rev = Revision(
        scene_id=uuid.UUID(scene_id),
        content="Séma teszt tartalom.",
        approved=False,
        revision_type="write_continue",
        model_name="gemini/gemini-pro",
        prompt_version="v2.1",
    )
    db_session.add(rev)
    await db_session.commit()

    resp = await client.get(f"/api/v1/revisions/{rev.id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert "scene_id" in data
    assert "job_id" in data
    assert "content" in data
    assert "approved" in data
    assert "revision_type" in data
    assert "model_name" in data
    assert "prompt_version" in data
    assert "created_at" in data
    assert "updated_at" in data
    assert data["prompt_version"] == "v2.1"
