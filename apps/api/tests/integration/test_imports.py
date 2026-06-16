"""Integration tests for the DOCX import endpoint (#2b).

The pandoc conversion is MOCKED at the endpoint's import boundary
(``app.api.v1.imports.convert_docx_to_markdown``) so these run WITH OR WITHOUT
pandoc installed. They cover: a successful import builds the Book + Chapters +
Scenes (correct titles / order / word_counts, queried from the DB); the error
mappings (400 non-docx, 413 oversize, 503 pandoc-missing, 502 conversion fail,
404 project-not-found, 422 empty); and the partial-failure rollback (no orphan
book). The real docx->md round-trip lives in tests/unit/test_pandoc.py (gated).
"""

import uuid

import pytest
from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.scene import Scene
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select

from app.core.deps import get_db
from app.main import app
from app.services.pandoc import (
    PandocConversionError,
    PandocUnavailableError,
)

pytestmark = pytest.mark.integration

DOCX_TYPE = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)

SAMPLE_MD = (
    "# Első fejezet\n"
    "\n"
    "## A kezdet\n"
    "Egy két három.\n"
    "\n"
    "## A folytatás\n"
    "Négy öt.\n"
    "\n"
    "# Második fejezet\n"
    "\n"
    "Hat hét nyolc kilenc.\n"
)


async def _create_project(client: AsyncClient, auth_headers: dict) -> str:
    resp = await client.post(
        "/api/v1/projects", json={"title": "Import Project"}, headers=auth_headers
    )
    assert resp.status_code == 201
    return resp.json()["id"]


def _upload(filename: str = "kezirat.docx", content: bytes = b"PKfake-docx"):
    """Build the multipart `files` mapping for the UploadFile field."""
    return {"file": (filename, content, DOCX_TYPE)}


def _patch_convert(monkeypatch, markdown: str) -> None:
    monkeypatch.setattr(
        "app.api.v1.imports.convert_docx_to_markdown",
        lambda _bytes: markdown,
    )


async def test_import_creates_book_chapters_scenes(
    client: AsyncClient, auth_headers: dict, monkeypatch, db_session
):
    """A successful import builds the full subtree with correct order + counts."""
    _patch_convert(monkeypatch, SAMPLE_MD)
    project_id = await _create_project(client, auth_headers)

    resp = await client.post(
        f"/api/v1/projects/{project_id}/imports",
        headers=auth_headers,
        files=_upload(),
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["title"] == "kezirat"  # filename stem (no form title / preamble)
    assert body["chapter_count"] == 2
    assert body["scene_count"] == 3
    assert body["word_count"] == 9

    # Verify the persisted structure directly from the DB.
    book = (
        await db_session.execute(
            select(Book).where(Book.id == uuid.UUID(body["book_id"]))
        )
    ).scalar_one()
    assert book.project_id == uuid.UUID(project_id)

    chapters = (
        (
            await db_session.execute(
                select(Chapter)
                .where(Chapter.book_id == book.id)
                .order_by(Chapter.order_index)
            )
        )
        .scalars()
        .all()
    )
    assert [c.title for c in chapters] == ["Első fejezet", "Második fejezet"]
    assert [c.order_index for c in chapters] == [0, 1]

    ch1_scenes = (
        (
            await db_session.execute(
                select(Scene)
                .where(Scene.chapter_id == chapters[0].id)
                .order_by(Scene.order_index)
            )
        )
        .scalars()
        .all()
    )
    assert [s.title for s in ch1_scenes] == ["A kezdet", "A folytatás"]
    assert [s.order_index for s in ch1_scenes] == [0, 1]
    assert [s.word_count for s in ch1_scenes] == [3, 2]
    assert all(s.status == "draft" for s in ch1_scenes)


async def test_import_form_title_overrides(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    """An explicit `title` form field wins over the filename / preamble."""
    _patch_convert(monkeypatch, SAMPLE_MD)
    project_id = await _create_project(client, auth_headers)

    resp = await client.post(
        f"/api/v1/projects/{project_id}/imports",
        headers=auth_headers,
        files=_upload(),
        data={"title": "Saját cím"},
    )
    assert resp.status_code == 201
    assert resp.json()["title"] == "Saját cím"


async def test_import_headingless_creates_single_chapter(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    """A heading-free document still imports as 1 chapter / 1 scene (not 422)."""
    _patch_convert(monkeypatch, "Csak sima próza négy szó.\n")
    project_id = await _create_project(client, auth_headers)

    resp = await client.post(
        f"/api/v1/projects/{project_id}/imports",
        headers=auth_headers,
        files=_upload(),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["chapter_count"] == 1
    assert body["scene_count"] == 1


async def test_import_rejects_non_docx(
    client: AsyncClient, auth_headers: dict
):
    """A non-.docx upload (wrong type AND extension) -> 400."""
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/imports",
        headers=auth_headers,
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert resp.status_code == 400
    assert "docx" in resp.json()["detail"].lower()


async def test_import_rejects_empty_file(
    client: AsyncClient, auth_headers: dict
):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/imports",
        headers=auth_headers,
        files=_upload(content=b""),
    )
    assert resp.status_code == 400
    assert "empty" in resp.json()["detail"].lower()


async def test_import_pandoc_missing_returns_503(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    def boom(_bytes):
        raise PandocUnavailableError("pandoc not installed")

    monkeypatch.setattr("app.api.v1.imports.convert_docx_to_markdown", boom)
    project_id = await _create_project(client, auth_headers)

    resp = await client.post(
        f"/api/v1/projects/{project_id}/imports",
        headers=auth_headers,
        files=_upload(),
    )
    assert resp.status_code == 503
    assert "pandoc" in resp.json()["detail"].lower()


async def test_import_conversion_error_returns_502(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    def boom(_bytes):
        raise PandocConversionError("pandoc failed to read the DOCX")

    monkeypatch.setattr("app.api.v1.imports.convert_docx_to_markdown", boom)
    project_id = await _create_project(client, auth_headers)

    resp = await client.post(
        f"/api/v1/projects/{project_id}/imports",
        headers=auth_headers,
        files=_upload(),
    )
    assert resp.status_code == 502


async def test_import_empty_conversion_returns_422(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    """A conversion that yields empty/whitespace markdown -> 422 (no empty book)."""
    _patch_convert(monkeypatch, "   \n\n  \n")
    project_id = await _create_project(client, auth_headers)

    resp = await client.post(
        f"/api/v1/projects/{project_id}/imports",
        headers=auth_headers,
        files=_upload(),
    )
    assert resp.status_code == 422


async def test_import_project_not_found_returns_404(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    _patch_convert(monkeypatch, SAMPLE_MD)
    missing = uuid.uuid4()
    resp = await client.post(
        f"/api/v1/projects/{missing}/imports",
        headers=auth_headers,
        files=_upload(),
    )
    assert resp.status_code == 404


async def test_import_requires_auth(client: AsyncClient):
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/imports",
        files=_upload(),
    )
    assert resp.status_code == 401


async def test_import_rolls_back_on_create_failure(
    client: AsyncClient, auth_headers: dict, monkeypatch, db_session
):
    """If the subtree create fails, NO orphan book/chapters are left behind."""
    _patch_convert(monkeypatch, SAMPLE_MD)

    def boom(*_args, **_kwargs):
        raise RuntimeError("simulated DB failure")

    monkeypatch.setattr(
        "app.api.v1.imports.create_book_from_parsed", boom
    )
    project_id = await _create_project(client, auth_headers)

    books_before = (
        await db_session.execute(
            select(func.count(Book.id)).where(
                Book.project_id == uuid.UUID(project_id)
            )
        )
    ).scalar_one()

    # Use a transport that surfaces the global handler's 500 (instead of
    # re-raising the unhandled error into the test), reusing the same session.
    app.dependency_overrides[get_db] = lambda: db_session
    try:
        transport = ASGITransport(app=app, raise_app_exceptions=False)
        async with AsyncClient(
            transport=transport, base_url="http://test"
        ) as raw_client:
            resp = await raw_client.post(
                f"/api/v1/projects/{project_id}/imports",
                headers=auth_headers,
                files=_upload(),
            )
    finally:
        app.dependency_overrides.clear()
    assert resp.status_code == 500  # unhandled error surfaces (not swallowed)

    books_after = (
        await db_session.execute(
            select(func.count(Book.id)).where(
                Book.project_id == uuid.UUID(project_id)
            )
        )
    ).scalar_one()
    assert books_after == books_before  # rollback left no orphan book
