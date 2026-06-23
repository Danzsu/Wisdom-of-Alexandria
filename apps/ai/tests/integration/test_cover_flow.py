"""Cross-resource cover flow integration test (Task 10).

Exercises the full end-to-end cover pipeline with NO Redis and NO real
provider call:

  POST /ai/covers
    → job captured via monkeypatched enqueue_image_job
  → _run_image_job inline against the test DB session
    (ImageService with a fake router that returns a small real PNG;
     CoverCompositor runs for real — fonts are bundled)
  → GET /ai/images?entity_type=cover&entity_id=<book_id>
    → exactly 1 "ready" cover, entity_type == "cover"
  → POST /ai/images/<id>/canonical
    → is_canonical == True
  → GET /ai/media/<id>
    → 200, content-type image/*
"""

from __future__ import annotations

import io
import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import pytest
from alexandria_core.core.config import settings
from alexandria_core.models.book import Book
from alexandria_core.models.project import Project
from alexandria_core.models.provider import Provider
from PIL import Image
from sqlalchemy.ext.asyncio import AsyncSession

from app.jobs.image_job import _run_image_job
from app.services.image_service import ImageService
from app.services.model_router import ImageResult

pytestmark = pytest.mark.asyncio


# ── helpers ───────────────────────────────────────────────────────────────────


def _session_factory(db_session: AsyncSession):
    """Inject the test's transactional session as the worker's session factory.

    Mirrors the shim in test_image_job.py: the context manager yields the
    session without closing it (the fixture owns its lifecycle).
    """

    @asynccontextmanager
    async def _factory():
        yield db_session

    return _factory


async def _make_project(db: AsyncSession) -> uuid.UUID:
    project = Project(title="Borító flow projekt")
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project.id


async def _make_book(
    db: AsyncSession,
    project_id: uuid.UUID,
    title: str = "A Fárosz árnyéka",
    author: str = "Rácz Dániel",
) -> uuid.UUID:
    book = Book(project_id=project_id, title=title, author=author)
    db.add(book)
    await db.commit()
    await db.refresh(book)
    return book.id


async def _make_provider_with_image_model(
    db: AsyncSession,
    image_model: str = "gemini/imagen-3",
) -> Provider:
    provider = Provider(
        type="gemini",
        label="Borító képgeneráló",
        image_model=image_model,
        enabled=True,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return provider


def _fake_router(color: tuple[int, int, int] = (12, 34, 56)) -> AsyncMock:
    """Build a stub ModelRouter whose generate_image returns a real small PNG.

    The PNG is intentionally the right aspect-ratio for a 2:3 cover so the
    compositor's crop step is trivial (no scale-up needed).
    """
    buf = io.BytesIO()
    Image.new("RGB", (1024, 1536), color).save(buf, "PNG")
    png_bytes = buf.getvalue()

    router = AsyncMock()
    router.generate_image = AsyncMock(
        return_value=ImageResult(data=png_bytes, mime="image/png", model="gemini/x")
    )
    return router


# ── flow test ─────────────────────────────────────────────────────────────────


@pytest.mark.integration
async def test_cover_end_to_end(
    client,
    auth_headers,
    db_session: AsyncSession,
    monkeypatch,
    tmp_path,
):
    """POST /ai/covers → run the job inline (mocked provider) → the cover
    appears in GET /ai/images?entity_type=cover as 'ready' → can be made
    canonical → GET /ai/media streams image bytes."""

    # ── 1. redirect media_dir to a writable tmp location ──────────────────────
    monkeypatch.setattr(settings, "media_dir", str(tmp_path))

    # ── 2. capture the enqueued job id (skip Redis) ────────────────────────────
    captured_job_id: list[uuid.UUID] = []
    import app.api.v1.covers as covers_mod

    monkeypatch.setattr(
        covers_mod,
        "enqueue_image_job",
        lambda jid: captured_job_id.append(jid),
    )

    # ── 3. seed DB fixtures ────────────────────────────────────────────────────
    await _make_provider_with_image_model(db_session, "gemini/x")
    project_id = await _make_project(db_session)
    book_id = await _make_book(
        db_session, project_id, title="Fárosz", author="Rácz D."
    )

    # ── 4. POST /ai/covers → 202 ───────────────────────────────────────────────
    post_resp = await client.post(
        "/api/v1/ai/covers",
        headers=auth_headers,
        json={
            "book_id": str(book_id),
            "art_style": "cover_fantasy",
            "layout": "classic_centered",
        },
    )
    assert post_resp.status_code == 202, post_resp.text
    post_body = post_resp.json()
    assert post_body["entity_type"] == "cover"
    assert post_body["status"] == "generating"
    assert len(captured_job_id) == 1

    # ── 5. run the job inline (real compositor, fake provider) ─────────────────
    fake_images = ImageService(router=_fake_router())
    await _run_image_job(
        captured_job_id[0],
        session_factory=_session_factory(db_session),
        images=fake_images,
    )

    # ── 6. GET /ai/images?entity_type=cover&entity_id=<book_id> ───────────────
    # The POST creates a "generating" placeholder; the job UPDATES that same row
    # to "ready". Exactly ONE cover total, and it must be "ready".
    list_resp = await client.get(
        f"/api/v1/ai/images?entity_type=cover&entity_id={book_id}",
        headers=auth_headers,
    )
    assert list_resp.status_code == 200, list_resp.text
    all_covers = list_resp.json()
    assert all(c["entity_type"] == "cover" for c in all_covers)
    assert len(all_covers) == 1, (
        f"expected exactly 1 cover asset total (single-asset lifecycle), "
        f"got {len(all_covers)} (statuses: {[c['status'] for c in all_covers]})"
    )
    cover = all_covers[0]
    assert cover["status"] == "ready", f"cover status was '{cover['status']}', expected 'ready'"
    assert cover["entity_id"] == str(book_id)
    cover_id = cover["id"]
    # The cover_id must be the placeholder id returned in the POST response.
    assert cover_id == post_body["id"], "job must update the placeholder, not create a new row"

    # ── 7. POST /ai/images/<id>/canonical → is_canonical flipped ──────────────
    canon_resp = await client.post(
        f"/api/v1/ai/images/{cover_id}/canonical",
        headers=auth_headers,
    )
    assert canon_resp.status_code == 200, canon_resp.text
    assert canon_resp.json()["is_canonical"] is True

    # ── 8. GET /ai/media/<id> → real PNG bytes ─────────────────────────────────
    media_resp = await client.get(
        f"/api/v1/ai/media/{cover_id}",
        headers=auth_headers,
    )
    assert media_resp.status_code == 200, media_resp.text
    assert media_resp.headers["content-type"].startswith("image/")
    # The compositor produces a 1600×2560 PNG; confirm we got a real PNG back.
    with Image.open(io.BytesIO(media_resp.content)) as img:
        assert img.format == "PNG"
        assert img.size == (1600, 2560)
