"""ImageService orchestration tests (Phase 1 — AI image generation).

These exercise the full save → MediaAsset lifecycle against a tmp media_dir
(monkeypatched ``settings.media_dir``) and a stubbed ModelRouter whose
``generate_image`` returns a real tiny PNG so ``save_image`` / thumbnailing run
for real. The cosine/pgvector path is not involved, so all of these run on
SQLite (``@pytest.mark.integration``).
"""

import io
import os
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from alexandria_core.core.config import settings
from alexandria_core.models.character import Character
from alexandria_core.models.media_asset import MediaAsset
from alexandria_core.models.project import Project
from PIL import Image
from sqlalchemy import func, select

from app.services.image_service import ImageService
from app.services.model_router import ImageResult


def _tiny_png(size: tuple[int, int] = (8, 8)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size).save(buf, "PNG")
    return buf.getvalue()


def _stub_router(png: bytes | None = None) -> AsyncMock:
    router = AsyncMock()
    router.generate_image = AsyncMock(
        return_value=ImageResult(
            data=png if png is not None else _tiny_png(),
            mime="image/png",
            model="gemini-3.1-flash-image",
        )
    )
    return router


async def _make_project(db) -> uuid.UUID:
    project = Project(title="Kép projekt")
    db.add(project)
    await db.flush()
    await db.commit()
    return project.id


async def _make_character(db, project_id: uuid.UUID, name: str = "Aragorn") -> Character:
    char = Character(
        project_id=project_id,
        name=name,
        appearance="Magas, sötét hajú vándor kopott köpenyben.",
        personality="Zárkózott de hűséges.",
        role="Hős",
        ai_visible=True,
    )
    db.add(char)
    await db.flush()
    await db.commit()
    return char


@pytest.fixture(autouse=True)
def _tmp_media_dir(tmp_path, monkeypatch):
    media = tmp_path / "media"
    monkeypatch.setattr(settings, "media_dir", str(media))
    return media


async def _count_assets(db) -> int:
    return (
        await db.execute(select(func.count()).select_from(MediaAsset))
    ).scalar_one()


# ── generate_for_entity happy path ──────────────────────────────────────────


@pytest.mark.integration
async def test_generate_for_character_writes_file_and_ready_asset(
    db_session, _tmp_media_dir
):
    project_id = await _make_project(db_session)
    char = await _make_character(db_session, project_id)

    router = _stub_router()
    svc = ImageService(router=router)
    asset = await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/gemini-3.1-flash-image",
    )

    assert asset.status == "ready"
    assert asset.width == 8
    assert asset.height == 8
    assert asset.model_name == "gemini-3.1-flash-image"
    assert asset.style == "realistic_portrait"
    assert asset.is_canonical is False
    # The prompt persisted on the asset includes the character name + appearance.
    assert "Aragorn" in asset.prompt
    assert "vándor" in asset.prompt

    # File actually written to disk under the tmp media dir, keyed by uuids.
    assert asset.file_path is not None
    assert os.path.exists(asset.file_path)
    assert os.path.exists(asset.thumb_path)
    assert str(project_id) in asset.file_path
    assert str(asset.id) in asset.file_path

    # The prompt passed to the provider carried the appearance text.
    call_args = router.generate_image.await_args
    sent_prompt = call_args.args[0] if call_args.args else call_args.kwargs["prompt"]
    assert "vándor" in sent_prompt


@pytest.mark.integration
async def test_generate_for_missing_entity_raises(db_session, _tmp_media_dir):
    project_id = await _make_project(db_session)
    svc = ImageService(router=_stub_router())
    with pytest.raises(ValueError):
        await svc.generate_for_entity(
            db_session,
            project_id=project_id,
            entity_type="character",
            entity_id=uuid.uuid4(),
            style="realistic_portrait",
            model="gemini/x",
        )


# ── canonical reference is fed back into the next generation ─────────────────


@pytest.mark.integration
async def test_existing_canonical_passed_as_reference(db_session, _tmp_media_dir):
    project_id = await _make_project(db_session)
    char = await _make_character(db_session, project_id)

    router = _stub_router()
    svc = ImageService(router=router)

    first = await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/x",
    )
    # No reference on the first call (no canonical yet).
    first_kwargs = router.generate_image.await_args.kwargs
    assert not first_kwargs.get("reference_images")

    await svc.set_canonical(db_session, first.id)

    await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/x",
    )
    # Second call now passes the canonical image bytes as a reference.
    second_kwargs = router.generate_image.await_args.kwargs
    refs = second_kwargs.get("reference_images")
    assert refs
    assert len(refs) == 1
    assert isinstance(refs[0], bytes)
    assert len(refs[0]) > 0


# ── set_canonical one-canonical invariant (mutation-proof) ───────────────────


@pytest.mark.integration
async def test_set_canonical_clears_previous(db_session, _tmp_media_dir):
    project_id = await _make_project(db_session)
    char = await _make_character(db_session, project_id)
    svc = ImageService(router=_stub_router())

    a1 = await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/x",
    )
    a2 = await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/x",
    )

    await svc.set_canonical(db_session, a1.id)
    await db_session.refresh(a1)
    assert a1.is_canonical is True

    await svc.set_canonical(db_session, a2.id)
    await db_session.refresh(a1)
    await db_session.refresh(a2)
    # Exactly ONE canonical per entity: a1 is cleared, a2 set.
    assert a1.is_canonical is False
    assert a2.is_canonical is True

    canonical_count = (
        await db_session.execute(
            select(func.count())
            .select_from(MediaAsset)
            .where(
                MediaAsset.entity_type == "character",
                MediaAsset.entity_id == char.id,
                MediaAsset.is_canonical.is_(True),
            )
        )
    ).scalar_one()
    assert canonical_count == 1


@pytest.mark.integration
async def test_set_canonical_missing_raises(db_session, _tmp_media_dir):
    svc = ImageService(router=_stub_router())
    with pytest.raises(ValueError):
        await svc.set_canonical(db_session, uuid.uuid4())


# ── list_for_entity newest-first + entity isolation ──────────────────────────


@pytest.mark.integration
async def test_list_for_entity_newest_first_and_isolated(db_session, _tmp_media_dir):
    project_id = await _make_project(db_session)
    char = await _make_character(db_session, project_id, name="Hős A")
    other = await _make_character(db_session, project_id, name="Hős B")
    svc = ImageService(router=_stub_router())

    older = await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/x",
    )
    newer = await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/x",
    )
    # A 2nd entity's asset must not leak in.
    await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=other.id,
        style="realistic_portrait",
        model="gemini/x",
    )

    # Make created_at unambiguous on coarse-resolution SQLite clocks.
    now = datetime.now(UTC)
    older.created_at = now - timedelta(minutes=5)
    newer.created_at = now
    await db_session.commit()

    listed = await svc.list_for_entity(db_session, "character", char.id)
    assert [a.id for a in listed] == [newer.id, older.id]  # newest-first
    # Isolation: only this entity's assets.
    assert all(a.entity_id == char.id for a in listed)
    assert len(listed) == 2


# ── delete removes the row AND the files ─────────────────────────────────────


@pytest.mark.integration
async def test_delete_removes_row_and_files(db_session, _tmp_media_dir):
    project_id = await _make_project(db_session)
    char = await _make_character(db_session, project_id)
    svc = ImageService(router=_stub_router())

    asset = await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/x",
    )
    file_path = asset.file_path
    thumb_path = asset.thumb_path
    asset_id = asset.id
    assert os.path.exists(file_path)

    await svc.delete(db_session, asset_id)

    assert await db_session.get(MediaAsset, asset_id) is None
    assert not os.path.exists(file_path)
    assert not os.path.exists(thumb_path)


@pytest.mark.integration
async def test_delete_missing_raises(db_session, _tmp_media_dir):
    svc = ImageService(router=_stub_router())
    with pytest.raises(ValueError):
        await svc.delete(db_session, uuid.uuid4())


# ── failure: provider error → raise, no ready asset, no partial file ─────────


@pytest.mark.integration
async def test_generation_failure_raises_and_leaves_no_partial(
    db_session, _tmp_media_dir
):
    project_id = await _make_project(db_session)
    char = await _make_character(db_session, project_id)

    router = AsyncMock()
    router.generate_image = AsyncMock(side_effect=RuntimeError("provider boom"))
    svc = ImageService(router=router)

    with pytest.raises(RuntimeError):
        await svc.generate_for_entity(
            db_session,
            project_id=project_id,
            entity_type="character",
            entity_id=char.id,
            style="realistic_portrait",
            model="gemini/x",
        )

    # No READY asset persisted, and no orphaned files left under the media dir.
    assert await _count_assets(db_session) == 0
    leftover = []
    for root, _dirs, files in os.walk(str(_tmp_media_dir)):
        leftover.extend(files)
    assert leftover == []
