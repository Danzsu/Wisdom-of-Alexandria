"""Tests for the MediaAsset model (AI image generation, Phase 1).

SQLite-safe: the model loads under create_all (the shared engine fixture already
ran it). An insert/read round-trips the row and verifies the column defaults
(``status``, ``mime``, ``is_canonical``) apply on flush.
"""

import uuid

import pytest
from alexandria_core.models.media_asset import MediaAsset
from alexandria_core.models.project import Project
from sqlalchemy import select


@pytest.mark.integration
async def test_media_asset_persists_and_defaults(db_session):
    # MediaAsset must be importable from its module.
    assert MediaAsset.__tablename__ == "media_assets"

    project = Project(title="Media proj")
    db_session.add(project)
    await db_session.flush()

    entity_id = uuid.uuid4()
    asset = MediaAsset(
        project_id=project.id,
        entity_type="character",
        entity_id=entity_id,
        status="ready",
        file_path="/m/x.png",
        model_name="gemini/gemini-3.1-flash-image",
        style="realistic_portrait",
        prompt="a portrait of the hero",
        width=1024,
        height=1536,
    )
    db_session.add(asset)
    await db_session.commit()

    loaded = (
        await db_session.execute(
            select(MediaAsset).where(MediaAsset.entity_id == entity_id)
        )
    ).scalar_one()
    assert loaded.project_id == project.id
    assert loaded.entity_type == "character"
    assert loaded.status == "ready"
    assert loaded.file_path == "/m/x.png"
    assert loaded.model_name == "gemini/gemini-3.1-flash-image"
    assert loaded.style == "realistic_portrait"
    assert loaded.prompt == "a portrait of the hero"
    assert loaded.width == 1024
    assert loaded.height == 1536
    # Default applied (not passed at construction).
    assert loaded.is_canonical is False


@pytest.mark.integration
async def test_media_asset_status_and_mime_defaults(db_session):
    project = Project(title="Media proj 2")
    db_session.add(project)
    await db_session.flush()

    # entity_id null is allowed (project-level covers later).
    asset = MediaAsset(
        project_id=project.id,
        entity_type="location",
        entity_id=None,
    )
    db_session.add(asset)
    await db_session.flush()
    await db_session.refresh(asset)

    assert asset.status == "generating"
    assert asset.mime == "image/png"
    assert asset.entity_id is None
