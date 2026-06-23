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
from alexandria_core.models.book import Book
from alexandria_core.models.codex_entry import CodexEntry
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


async def _make_character(db, project_id: uuid.UUID, name: str = "Aragorn") -> CodexEntry:
    entry = CodexEntry(
        project_id=project_id,
        entry_type="character",
        title=name,
        content="Magas, sötét hajú vándor kopott köpenyben. Zárkózott de hűséges.",
        role="Hős",
        ai_visible=True,
    )
    db.add(entry)
    await db.flush()
    await db.commit()
    return entry


async def _make_book(
    db,
    project_id: uuid.UUID,
    title: str = "A Fárosz árnyéka",
    author: str = "Rácz Dániel",
) -> uuid.UUID:
    book = Book(project_id=project_id, title=title, author=author)
    db.add(book)
    await db.flush()
    await db.commit()
    return book.id


@pytest.fixture(autouse=True)
def _tmp_media_dir(tmp_path, monkeypatch):
    media = tmp_path / "media"
    monkeypatch.setattr(settings, "media_dir", str(media))
    return media


async def _count_assets(db) -> int:
    return (
        await db.execute(select(func.count()).select_from(MediaAsset))
    ).scalar_one()


async def _make_placeholder(
    db,
    project_id: uuid.UUID,
    entity_type: str,
    entity_id: uuid.UUID,
    style: str = "realistic_portrait",
) -> MediaAsset:
    """Create a 'generating' placeholder as the endpoint does before enqueueing."""
    placeholder = MediaAsset(
        status="generating",
        project_id=project_id,
        entity_type=entity_type,
        entity_id=entity_id,
        style=style,
        model_name="gemini/x",
    )
    db.add(placeholder)
    await db.commit()
    await db.refresh(placeholder)
    return placeholder


# ── generate_for_entity happy path ──────────────────────────────────────────


@pytest.mark.integration
async def test_generate_for_character_writes_file_and_ready_asset(
    db_session, _tmp_media_dir
):
    project_id = await _make_project(db_session)
    char = await _make_character(db_session, project_id)
    placeholder = await _make_placeholder(db_session, project_id, "character", char.id)

    router = _stub_router()
    svc = ImageService(router=router)
    asset = await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/gemini-3.1-flash-image",
        asset_id=placeholder.id,
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
    # Use a random entity_id so the CodexEntry lookup fails (entity doesn't exist).
    missing_entity_id = uuid.uuid4()
    placeholder = await _make_placeholder(
        db_session, project_id, "character", missing_entity_id
    )
    svc = ImageService(router=_stub_router())
    with pytest.raises(ValueError):
        await svc.generate_for_entity(
            db_session,
            project_id=project_id,
            entity_type="character",
            entity_id=missing_entity_id,
            style="realistic_portrait",
            model="gemini/x",
            asset_id=placeholder.id,
        )


# ── canonical reference is fed back into the next generation ─────────────────


@pytest.mark.integration
async def test_existing_canonical_passed_as_reference(db_session, _tmp_media_dir):
    project_id = await _make_project(db_session)
    char = await _make_character(db_session, project_id)

    router = _stub_router()
    svc = ImageService(router=router)

    ph1 = await _make_placeholder(db_session, project_id, "character", char.id)
    first = await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/x",
        asset_id=ph1.id,
    )
    # No reference on the first call (no canonical yet).
    first_kwargs = router.generate_image.await_args.kwargs
    assert not first_kwargs.get("reference_images")

    await svc.set_canonical(db_session, first.id)

    ph2 = await _make_placeholder(db_session, project_id, "character", char.id)
    await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/x",
        asset_id=ph2.id,
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

    ph1 = await _make_placeholder(db_session, project_id, "character", char.id)
    a1 = await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/x",
        asset_id=ph1.id,
    )
    ph2 = await _make_placeholder(db_session, project_id, "character", char.id)
    a2 = await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/x",
        asset_id=ph2.id,
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

    ph_older = await _make_placeholder(db_session, project_id, "character", char.id)
    older = await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/x",
        asset_id=ph_older.id,
    )
    ph_newer = await _make_placeholder(db_session, project_id, "character", char.id)
    newer = await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/x",
        asset_id=ph_newer.id,
    )
    # A 2nd entity's asset must not leak in.
    ph_other = await _make_placeholder(db_session, project_id, "character", other.id)
    await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=other.id,
        style="realistic_portrait",
        model="gemini/x",
        asset_id=ph_other.id,
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

    placeholder = await _make_placeholder(db_session, project_id, "character", char.id)
    asset = await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/x",
        asset_id=placeholder.id,
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

    placeholder = await _make_placeholder(db_session, project_id, "character", char.id)
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
            asset_id=placeholder.id,
        )

    # The placeholder row still exists (service is LOUD — re-raises, never flips
    # status itself; the job layer owns the 'failed' flip).  No NEW rows created.
    assert await _count_assets(db_session) == 1
    await db_session.refresh(placeholder)
    assert placeholder.status == "generating"  # service never mutates on failure
    # No partial files written to disk.
    leftover = []
    for root, _dirs, files in os.walk(str(_tmp_media_dir)):
        leftover.extend(files)
    assert leftover == []


# ── generate_cover_for_book ───────────────────────────────────────────────────


@pytest.mark.integration
async def test_generate_cover_for_book_persists_cover_asset(
    db_session, monkeypatch, tmp_path
):
    monkeypatch.setattr(settings, "media_dir", str(tmp_path))

    project_id = await _make_project(db_session)
    book_id = await _make_book(db_session, project_id, title="Fárosz", author="Rácz D.")
    placeholder = await _make_placeholder(
        db_session, project_id, "cover", book_id, style="cover_fantasy"
    )

    async def fake_generate_image(
        prompt, *, model, db, reference_images=None, aspect_ratio="2:3", **kw
    ):
        buf = io.BytesIO()
        Image.new("RGB", (1024, 1536), (10, 20, 30)).save(buf, "PNG")
        return ImageResult(data=buf.getvalue(), mime="image/png", model=model)

    svc = ImageService()
    monkeypatch.setattr(svc.router, "generate_image", fake_generate_image)

    asset = await svc.generate_cover_for_book(
        db_session,
        project_id=project_id,
        book_id=book_id,
        art_style="cover_fantasy",
        layout="classic_centered",
        title="Fárosz",
        author="Rácz D.",
        subtitle=None,
        model="gemini/x",
        asset_id=placeholder.id,
    )
    assert asset.entity_type == "cover"
    assert asset.entity_id == book_id
    assert asset.status == "ready"
    assert asset.style == "cover_fantasy"
    assert asset.width == 1600 and asset.height == 2560


@pytest.mark.integration
async def test_generate_cover_for_book_missing_book_raises(db_session):
    project_id = await _make_project(db_session)
    missing_book_id = uuid.uuid4()
    placeholder = await _make_placeholder(
        db_session, project_id, "cover", missing_book_id, style="cover_fantasy"
    )
    svc = ImageService()
    with pytest.raises(ValueError):
        await svc.generate_cover_for_book(
            db_session,
            project_id=project_id,
            book_id=missing_book_id,
            art_style="cover_fantasy",
            layout="classic_centered",
            title="t",
            author="a",
            subtitle=None,
            model="m",
            asset_id=placeholder.id,
        )


# ── ADVERSARIAL: single-asset lifecycle (placeholder reuse) ──────────────────


@pytest.mark.integration
async def test_generate_for_entity_updates_placeholder_not_creates_new(
    db_session, _tmp_media_dir
):
    """After a successful codex-image generation the DB must contain EXACTLY
    ONE MediaAsset for the entity — the same row the endpoint created as the
    'generating' placeholder — and its status must be 'ready'.

    Before the fix: the service minted a brand-new uuid4 asset on success,
    leaving two rows (placeholder stuck 'generating' + a new 'ready' one).
    """
    project_id = await _make_project(db_session)
    char = await _make_character(db_session, project_id)

    # Pre-create the placeholder exactly as the endpoint does.
    placeholder = MediaAsset(
        status="generating",
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model_name="gemini/x",
    )
    db_session.add(placeholder)
    await db_session.commit()
    await db_session.refresh(placeholder)
    placeholder_id = placeholder.id

    svc = ImageService(router=_stub_router())
    asset = await svc.generate_for_entity(
        db_session,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model="gemini/x",
        asset_id=placeholder_id,
    )

    # Returned asset is the SAME row.
    assert asset.id == placeholder_id
    assert asset.status == "ready"

    # Exactly ONE row in the DB for this entity.
    total = (
        await db_session.execute(
            select(func.count())
            .select_from(MediaAsset)
            .where(
                MediaAsset.entity_type == "character",
                MediaAsset.entity_id == char.id,
            )
        )
    ).scalar_one()
    assert total == 1, f"Expected 1 MediaAsset, found {total} (double-row bug)"


@pytest.mark.integration
async def test_generate_cover_for_book_updates_placeholder_not_creates_new(
    db_session, monkeypatch, tmp_path
):
    """Same single-asset lifecycle invariant for the cover branch.

    Before the fix: service created a second row; placeholder stayed 'generating'.
    """
    monkeypatch.setattr(settings, "media_dir", str(tmp_path))

    project_id = await _make_project(db_session)
    book_id = await _make_book(db_session, project_id, title="Fárosz", author="Rácz D.")

    placeholder = MediaAsset(
        status="generating",
        project_id=project_id,
        entity_type="cover",
        entity_id=book_id,
        style="cover_fantasy",
        model_name="gemini/x",
    )
    db_session.add(placeholder)
    await db_session.commit()
    await db_session.refresh(placeholder)
    placeholder_id = placeholder.id

    async def fake_generate_image(
        prompt, *, model, db, reference_images=None, aspect_ratio="2:3", **kw
    ):
        buf = io.BytesIO()
        Image.new("RGB", (1024, 1536), (10, 20, 30)).save(buf, "PNG")
        return ImageResult(data=buf.getvalue(), mime="image/png", model=model)

    svc = ImageService()
    monkeypatch.setattr(svc.router, "generate_image", fake_generate_image)

    asset = await svc.generate_cover_for_book(
        db_session,
        project_id=project_id,
        book_id=book_id,
        art_style="cover_fantasy",
        layout="classic_centered",
        title="Fárosz",
        author="Rácz D.",
        subtitle=None,
        model="gemini/x",
        asset_id=placeholder_id,
    )

    # Returned asset is the SAME row.
    assert asset.id == placeholder_id
    assert asset.status == "ready"

    # Exactly ONE row.
    total = (
        await db_session.execute(
            select(func.count())
            .select_from(MediaAsset)
            .where(
                MediaAsset.entity_type == "cover",
                MediaAsset.entity_id == book_id,
            )
        )
    ).scalar_one()
    assert total == 1, f"Expected 1 MediaAsset, found {total} (double-row bug)"


@pytest.mark.integration
async def test_generate_for_entity_missing_placeholder_raises(
    db_session, _tmp_media_dir
):
    """Passing a non-existent asset_id raises ValueError (guard against lost jobs)."""
    project_id = await _make_project(db_session)
    char = await _make_character(db_session, project_id)
    svc = ImageService(router=_stub_router())

    with pytest.raises(ValueError, match="asset"):
        await svc.generate_for_entity(
            db_session,
            project_id=project_id,
            entity_type="character",
            entity_id=char.id,
            style="realistic_portrait",
            model="gemini/x",
            asset_id=uuid.uuid4(),
        )
