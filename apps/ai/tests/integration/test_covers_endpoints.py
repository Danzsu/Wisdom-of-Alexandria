"""Cover-generation HTTP layer (Phase 2) — endpoint contract tests.

Tests the following routes:
- POST /api/v1/ai/covers         → 202 with generating MediaAsset
- GET  /api/v1/ai/covers/styles  → list of cover art-style presets
- GET  /api/v1/ai/covers/layouts → list of cover layouts
- 422 for bad art_style / bad layout / missing book / no model

Redis/worker are never touched: ``enqueue_image_job`` is monkeypatched out in
the happy-path test so the test stays self-contained.
"""

import uuid

import pytest
from alexandria_core.models.book import Book
from alexandria_core.models.project import Project
from alexandria_core.models.provider import Provider
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio


# ── Test helpers ──────────────────────────────────────────────────────────────


async def _make_project(db: AsyncSession) -> uuid.UUID:
    project = Project(title="Borító projekt")
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project.id


async def _make_book(
    db: AsyncSession,
    project_id: uuid.UUID,
    title: str = "A Fárosz árnyéka",
    author: str | None = "Rácz Dániel",
) -> uuid.UUID:
    book = Book(project_id=project_id, title=title, author=author)
    db.add(book)
    await db.commit()
    await db.refresh(book)
    return book.id


async def _make_provider_with_image_model(
    db: AsyncSession, image_model: str = "gemini/imagen-3"
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


# ── POST /ai/covers — validation 422s ────────────────────────────────────────


async def test_post_cover_unknown_book_is_422(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    resp = await client.post(
        "/api/v1/ai/covers",
        headers=auth_headers,
        json={
            "book_id": str(uuid.uuid4()),
            "art_style": "cover_fantasy",
            "layout": "classic_centered",
        },
    )
    assert resp.status_code == 422


async def test_post_cover_bad_style_is_422(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    project_id = await _make_project(db_session)
    book_id = await _make_book(db_session, project_id)
    resp = await client.post(
        "/api/v1/ai/covers",
        headers=auth_headers,
        json={
            "book_id": str(book_id),
            "art_style": "realistic_portrait",
            "layout": "classic_centered",
        },
    )
    assert resp.status_code == 422


async def test_post_cover_bad_layout_is_422(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    project_id = await _make_project(db_session)
    book_id = await _make_book(db_session, project_id)
    resp = await client.post(
        "/api/v1/ai/covers",
        headers=auth_headers,
        json={
            "book_id": str(book_id),
            "art_style": "cover_fantasy",
            "layout": "nope",
        },
    )
    assert resp.status_code == 422


async def test_post_cover_no_model_configured_is_422(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    """Valid style+layout+book but NO enabled provider with an image_model → 422
    BEFORE any asset/job is created (the model check is the 4th validation)."""
    project_id = await _make_project(db_session)
    book_id = await _make_book(db_session, project_id)
    resp = await client.post(
        "/api/v1/ai/covers",
        headers=auth_headers,
        json={
            "book_id": str(book_id),
            "art_style": "cover_fantasy",
            "layout": "classic_centered",
        },
    )
    assert resp.status_code == 422
    assert "model" in resp.json()["detail"].lower()


# ── POST /ai/covers — happy path ──────────────────────────────────────────────


async def test_post_cover_happy_path_creates_generating_asset(
    client: AsyncClient,
    auth_headers: dict,
    db_session: AsyncSession,
    monkeypatch,
):
    import app.api.v1.covers as covers_mod

    enq: list[uuid.UUID] = []
    monkeypatch.setattr(covers_mod, "enqueue_image_job", lambda jid: enq.append(jid))

    # Seed an enabled provider with an image model so _resolve_image_model returns it.
    await _make_provider_with_image_model(db_session, "gemini/x")
    project_id = await _make_project(db_session)
    book_id = await _make_book(db_session, project_id, title="Fárosz", author="Rácz D.")

    resp = await client.post(
        "/api/v1/ai/covers",
        headers=auth_headers,
        json={
            "book_id": str(book_id),
            "art_style": "cover_fantasy",
            "layout": "classic_centered",
        },
    )
    assert resp.status_code == 202
    body = resp.json()
    assert body["entity_type"] == "cover"
    assert body["status"] == "generating"
    assert body["style"] == "cover_fantasy"
    assert len(enq) == 1


# ── GET /ai/covers/styles + /ai/covers/layouts ────────────────────────────────


async def test_get_cover_styles_and_layouts(
    client: AsyncClient, auth_headers: dict
):
    styles_resp = await client.get("/api/v1/ai/covers/styles", headers=auth_headers)
    assert styles_resp.status_code == 200
    styles = styles_resp.json()
    assert any(s["slug"] == "cover_fantasy" for s in styles)

    layouts_resp = await client.get("/api/v1/ai/covers/layouts", headers=auth_headers)
    assert layouts_resp.status_code == 200
    layouts = layouts_resp.json()
    assert any(lay["slug"] == "classic_centered" for lay in layouts)
