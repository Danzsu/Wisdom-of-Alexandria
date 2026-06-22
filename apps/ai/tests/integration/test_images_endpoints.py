"""Image-generation HTTP layer (Phase 1).

Covers the endpoints in ``app.api.v1.images``: enqueue an image-gen job, list an
entity's images, approve canonical, delete, list style presets, and SERVE the
image binary. The async machinery (RQ job, ImageService) is exercised
elsewhere; here we mock the enqueue (no Redis) and assert the HTTP contract:
auth, validation (422 before any create), sanitized 502 on enqueue failure, the
MediaAssetRead shape (no file_path leak), and /media traversal safety.
"""

import os
import uuid
from unittest.mock import patch

import pytest
from alexandria_core.core.config import settings
from alexandria_core.models.codex_entry import CodexEntry
from alexandria_core.models.generation_job import GenerationJob, JobType
from alexandria_core.models.media_asset import MediaAsset
from alexandria_core.models.project import Project
from alexandria_core.models.provider import Provider
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def _make_project(db: AsyncSession) -> uuid.UUID:
    project = Project(title="Kép projekt")
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project.id


async def _make_character(db: AsyncSession, project_id: uuid.UUID) -> uuid.UUID:
    entry = CodexEntry(
        project_id=project_id, entry_type="character", title="Szelene"
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry.id


async def _make_image_provider(db: AsyncSession) -> Provider:
    provider = Provider(
        type="gemini",
        label="Gemini képek",
        image_model="gemini/imagen-3",
        enabled=True,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return provider


async def _make_asset(
    db: AsyncSession,
    project_id: uuid.UUID,
    entity_id: uuid.UUID,
    *,
    status: str = "ready",
    file_path: str | None = None,
    thumb_path: str | None = None,
    is_canonical: bool = False,
) -> MediaAsset:
    asset = MediaAsset(
        project_id=project_id,
        entity_type="character",
        entity_id=entity_id,
        status=status,
        file_path=file_path,
        thumb_path=thumb_path,
        mime="image/png",
        style="realistic_portrait",
        is_canonical=is_canonical,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


# ── POST /images (enqueue) ────────────────────────────────────────────────────


@pytest.mark.integration
async def test_create_image_enqueues_job_and_persists_generating_asset(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    project_id = await _make_project(db_session)
    character_id = await _make_character(db_session, project_id)
    await _make_image_provider(db_session)

    with patch("app.api.v1.images.enqueue_image_job") as mock_enqueue:
        resp = await client.post(
            "/api/v1/ai/images",
            json={
                "entity_type": "character",
                "entity_id": str(character_id),
                "project_id": str(project_id),
                "style": "realistic_portrait",
            },
            headers=auth_headers,
        )
    assert resp.status_code == 202
    data = resp.json()
    assert data["status"] == "generating"
    assert data["entity_type"] == "character"
    assert data["entity_id"] == str(character_id)
    assert data["style"] == "realistic_portrait"
    # MediaAssetRead must NOT leak filesystem paths.
    assert "file_path" not in data
    assert "thumb_path" not in data

    job = (
        await db_session.execute(
            select(GenerationJob).where(GenerationJob.project_id == project_id)
        )
    ).scalar_one()
    assert job.job_type == JobType.IMAGE

    mock_enqueue.assert_called_once()
    (enqueued_id,) = mock_enqueue.call_args.args
    assert str(enqueued_id) == str(job.id)

    asset = (
        await db_session.execute(
            select(MediaAsset).where(MediaAsset.id == uuid.UUID(data["id"]))
        )
    ).scalar_one()
    assert asset.status == "generating"
    assert asset.job_id == job.id


@pytest.mark.integration
async def test_create_image_unknown_entity_type_is_422(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    project_id = await _make_project(db_session)
    await _make_image_provider(db_session)
    with patch("app.api.v1.images.enqueue_image_job") as mock_enqueue:
        resp = await client.post(
            "/api/v1/ai/images",
            json={
                "entity_type": "dragon",
                "entity_id": str(uuid.uuid4()),
                "project_id": str(project_id),
                "style": "realistic_portrait",
            },
            headers=auth_headers,
        )
    assert resp.status_code == 422
    mock_enqueue.assert_not_called()


@pytest.mark.integration
async def test_create_image_invalid_style_for_entity_type_is_422(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    project_id = await _make_project(db_session)
    character_id = await _make_character(db_session, project_id)
    await _make_image_provider(db_session)
    with patch("app.api.v1.images.enqueue_image_job") as mock_enqueue:
        resp = await client.post(
            "/api/v1/ai/images",
            json={
                "entity_type": "character",
                "entity_id": str(character_id),
                "project_id": str(project_id),
                # location style requested for a character → invalid
                "style": "epic_landscape",
            },
            headers=auth_headers,
        )
    assert resp.status_code == 422
    mock_enqueue.assert_not_called()


@pytest.mark.integration
async def test_create_image_nonexistent_project_is_422(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    await _make_image_provider(db_session)
    with patch("app.api.v1.images.enqueue_image_job") as mock_enqueue:
        resp = await client.post(
            "/api/v1/ai/images",
            json={
                "entity_type": "character",
                "entity_id": str(uuid.uuid4()),
                "project_id": str(uuid.uuid4()),
                "style": "realistic_portrait",
            },
            headers=auth_headers,
        )
    assert resp.status_code == 422
    mock_enqueue.assert_not_called()


@pytest.mark.integration
async def test_create_image_nonexistent_entity_is_422(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    """A valid project but an entity_id with no matching CodexEntry → 422."""
    project_id = await _make_project(db_session)
    await _make_image_provider(db_session)
    with patch("app.api.v1.images.enqueue_image_job") as mock_enqueue:
        resp = await client.post(
            "/api/v1/ai/images",
            json={
                "entity_type": "character",
                "entity_id": str(uuid.uuid4()),
                "project_id": str(project_id),
                "style": "realistic_portrait",
            },
            headers=auth_headers,
        )
    assert resp.status_code == 422
    mock_enqueue.assert_not_called()


@pytest.mark.integration
async def test_create_image_wrong_entry_type_is_422(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    """The CodexEntry exists but its entry_type disagrees with the request → 422."""
    project_id = await _make_project(db_session)
    # A location entry referenced as a character.
    entry = CodexEntry(
        project_id=project_id, entry_type="location", title="Könyvtár"
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    await _make_image_provider(db_session)
    with patch("app.api.v1.images.enqueue_image_job") as mock_enqueue:
        resp = await client.post(
            "/api/v1/ai/images",
            json={
                "entity_type": "character",
                "entity_id": str(entry.id),
                "project_id": str(project_id),
                "style": "realistic_portrait",
            },
            headers=auth_headers,
        )
    assert resp.status_code == 422
    mock_enqueue.assert_not_called()


@pytest.mark.integration
async def test_create_image_no_model_configured_is_422(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    """No enabled provider with an image_model AND no model in the body → 422."""
    project_id = await _make_project(db_session)
    character_id = await _make_character(db_session, project_id)
    with patch("app.api.v1.images.enqueue_image_job") as mock_enqueue:
        resp = await client.post(
            "/api/v1/ai/images",
            json={
                "entity_type": "character",
                "entity_id": str(character_id),
                "project_id": str(project_id),
                "style": "realistic_portrait",
            },
            headers=auth_headers,
        )
    assert resp.status_code == 422
    mock_enqueue.assert_not_called()


@pytest.mark.integration
async def test_create_image_requires_auth(client: AsyncClient):
    resp = await client.post(
        "/api/v1/ai/images",
        json={
            "entity_type": "character",
            "entity_id": str(uuid.uuid4()),
            "project_id": str(uuid.uuid4()),
            "style": "realistic_portrait",
        },
    )
    assert resp.status_code == 401


@pytest.mark.integration
async def test_create_image_enqueue_failure_marks_job_and_asset_failed(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    project_id = await _make_project(db_session)
    character_id = await _make_character(db_session, project_id)
    await _make_image_provider(db_session)
    with patch(
        "app.api.v1.images.enqueue_image_job",
        side_effect=RuntimeError("redis://:s3cr3t-leak-xyz@broker:6379 refused"),
    ):
        resp = await client.post(
            "/api/v1/ai/images",
            json={
                "entity_type": "character",
                "entity_id": str(character_id),
                "project_id": str(project_id),
                "style": "realistic_portrait",
            },
            headers=auth_headers,
        )
    assert resp.status_code == 502
    assert "s3cr3t-leak-xyz" not in resp.text
    assert "broker:6379" not in resp.text

    job = (
        await db_session.execute(
            select(GenerationJob).where(GenerationJob.project_id == project_id)
        )
    ).scalar_one()
    assert job.status == "failed"
    asset = (
        await db_session.execute(
            select(MediaAsset).where(MediaAsset.project_id == project_id)
        )
    ).scalar_one()
    assert asset.status == "failed"


# ── GET /images (list) ────────────────────────────────────────────────────────


@pytest.mark.integration
async def test_list_images_for_entity(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    project_id = await _make_project(db_session)
    character_id = await _make_character(db_session, project_id)
    await _make_asset(db_session, project_id, character_id)
    await _make_asset(db_session, project_id, character_id)
    # An asset for a different entity must not appear.
    other = await _make_character(db_session, project_id)
    await _make_asset(db_session, project_id, other)

    resp = await client.get(
        f"/api/v1/ai/images?entity_type=character&entity_id={character_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    assert all(a["entity_id"] == str(character_id) for a in data)
    assert all("file_path" not in a for a in data)


@pytest.mark.integration
async def test_list_images_requires_both_params(
    client: AsyncClient, auth_headers: dict
):
    resp = await client.get(
        "/api/v1/ai/images?entity_type=character", headers=auth_headers
    )
    assert resp.status_code == 422


# ── POST /images/{id}/canonical ───────────────────────────────────────────────


@pytest.mark.integration
async def test_set_canonical_flips_flag(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    project_id = await _make_project(db_session)
    character_id = await _make_character(db_session, project_id)
    asset = await _make_asset(db_session, project_id, character_id)

    resp = await client.post(
        f"/api/v1/ai/images/{asset.id}/canonical", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["is_canonical"] is True


@pytest.mark.integration
async def test_set_canonical_missing_is_404(
    client: AsyncClient, auth_headers: dict
):
    resp = await client.post(
        f"/api/v1/ai/images/{uuid.uuid4()}/canonical", headers=auth_headers
    )
    assert resp.status_code == 404


# ── DELETE /images/{id} ───────────────────────────────────────────────────────


@pytest.mark.integration
async def test_delete_image(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    project_id = await _make_project(db_session)
    character_id = await _make_character(db_session, project_id)
    asset = await _make_asset(db_session, project_id, character_id)

    resp = await client.delete(
        f"/api/v1/ai/images/{asset.id}", headers=auth_headers
    )
    assert resp.status_code == 204


@pytest.mark.integration
async def test_delete_image_missing_is_404(
    client: AsyncClient, auth_headers: dict
):
    resp = await client.delete(
        f"/api/v1/ai/images/{uuid.uuid4()}", headers=auth_headers
    )
    assert resp.status_code == 404


# ── GET /images/styles ────────────────────────────────────────────────────────


@pytest.mark.integration
async def test_list_styles_for_character(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        "/api/v1/ai/images/styles?entity_type=character", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    assert all(s["entity_type"] == "character" for s in data)
    slugs = {s["slug"] for s in data}
    assert "realistic_portrait" in slugs
    assert "epic_landscape" not in slugs  # that's a location style


# ── GET /media/{id} (serve binary) ────────────────────────────────────────────


@pytest.mark.integration
async def test_serve_media_returns_bytes(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    tmp_path,
    monkeypatch,
):
    media_dir = tmp_path / "media"
    media_dir.mkdir()
    monkeypatch.setattr(settings, "media_dir", str(media_dir))

    png = b"\x89PNG\r\n\x1a\n" + b"fake-image-bytes"
    file_path = media_dir / "img.png"
    file_path.write_bytes(png)

    project_id = await _make_project(db_session)
    character_id = await _make_character(db_session, project_id)
    asset = await _make_asset(
        db_session,
        project_id,
        character_id,
        status="ready",
        file_path=str(file_path),
    )

    resp = await client.get(f"/api/v1/ai/media/{asset.id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.content == png
    assert resp.headers["content-type"].startswith("image/png")


@pytest.mark.integration
async def test_serve_media_not_ready_is_404(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    project_id = await _make_project(db_session)
    character_id = await _make_character(db_session, project_id)
    asset = await _make_asset(
        db_session, project_id, character_id, status="generating", file_path=None
    )
    resp = await client.get(f"/api/v1/ai/media/{asset.id}", headers=auth_headers)
    assert resp.status_code == 404


@pytest.mark.integration
async def test_serve_media_no_auth_header_is_401(
    client: AsyncClient, db_session: AsyncSession
):
    """/media is HEADER-ONLY (no `?token=` query param): a request with no
    Authorization header → 401 (not 404). The JWT must never travel in a URL,
    so there is no query-param auth path to test."""
    project_id = await _make_project(db_session)
    character_id = await _make_character(db_session, project_id)
    asset = await _make_asset(db_session, project_id, character_id, status="ready")
    resp = await client.get(f"/api/v1/ai/media/{asset.id}")
    assert resp.status_code == 401


@pytest.mark.integration
async def test_serve_media_garbage_bearer_header_is_401(
    client: AsyncClient, db_session: AsyncSession
):
    """A malformed bearer token in the header → 401."""
    project_id = await _make_project(db_session)
    character_id = await _make_character(db_session, project_id)
    asset = await _make_asset(db_session, project_id, character_id, status="ready")
    resp = await client.get(
        f"/api/v1/ai/media/{asset.id}",
        headers={"Authorization": "Bearer not-a-valid-jwt"},
    )
    assert resp.status_code == 401


@pytest.mark.integration
async def test_serve_media_missing_is_404(client: AsyncClient, auth_headers: dict):
    resp = await client.get(
        f"/api/v1/ai/media/{uuid.uuid4()}", headers=auth_headers
    )
    assert resp.status_code == 404


@pytest.mark.integration
async def test_serve_media_path_outside_media_dir_is_404(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    tmp_path,
    monkeypatch,
):
    media_dir = tmp_path / "media"
    media_dir.mkdir()
    monkeypatch.setattr(settings, "media_dir", str(media_dir))

    # A file that exists but lives OUTSIDE media_dir → must be refused (404).
    outside = tmp_path / "outside.png"
    outside.write_bytes(b"\x89PNG\r\n\x1a\nleak")
    assert os.path.exists(outside)

    project_id = await _make_project(db_session)
    character_id = await _make_character(db_session, project_id)
    asset = await _make_asset(
        db_session,
        project_id,
        character_id,
        status="ready",
        file_path=str(outside),
    )
    resp = await client.get(f"/api/v1/ai/media/{asset.id}", headers=auth_headers)
    assert resp.status_code == 404
