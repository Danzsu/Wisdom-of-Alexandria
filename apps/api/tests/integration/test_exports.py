import uuid

from httpx import AsyncClient

DOCX_MEDIA_TYPE = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)
EPUB_MEDIA_TYPE = "application/epub+zip"
PDF_MEDIA_TYPE = "application/pdf"


async def _build_book(client, auth_headers):
    """Build a complete book with 2 chapters, each with 2 scenes."""
    proj = (await client.post("/api/v1/projects", json={"title": "P"}, headers=auth_headers)).json()
    book = (await client.post(
        f"/api/v1/projects/{proj['id']}/books",
        json={"title": "Az elveszett királyság", "genre": "Fantasy", "language": "hu", "word_count_target": 80000},
        headers=auth_headers,
    )).json()
    bid = book["id"]

    ch1 = (await client.post(f"/api/v1/books/{bid}/chapters", json={"title": "Prológus", "order_index": 0}, headers=auth_headers)).json()
    ch2 = (await client.post(f"/api/v1/books/{bid}/chapters", json={"title": "Az indulás", "order_index": 1}, headers=auth_headers)).json()

    await client.post(f"/api/v1/chapters/{ch1['id']}/scenes", json={"title": "Reggel", "content": "A nap felkelt.", "order_index": 0}, headers=auth_headers)
    await client.post(f"/api/v1/chapters/{ch1['id']}/scenes", json={"title": "Üres jelenet", "order_index": 1}, headers=auth_headers)
    await client.post(f"/api/v1/chapters/{ch2['id']}/scenes", json={"title": "Utazás", "content": "A hős lóra szállt.", "order_index": 0}, headers=auth_headers)

    return bid, ch1["id"], ch2["id"]


async def test_export_book_returns_markdown(client: AsyncClient, auth_headers: dict):
    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(f"/api/v1/books/{book_id}/exports", headers=auth_headers)
    assert resp.status_code == 200
    assert "text/markdown" in resp.headers["content-type"]


async def test_export_contains_book_title(client: AsyncClient, auth_headers: dict):
    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(f"/api/v1/books/{book_id}/exports", headers=auth_headers)
    assert "Az elveszett királyság" in resp.text
    # Structural: the book title is an H1 *line* (exact, so a heading-level
    # mutation H1->H2 is caught — `## …` is not the same line as `# …`).
    lines = resp.text.splitlines()
    assert "# Az elveszett királyság" in lines


async def test_export_contains_chapters(client: AsyncClient, auth_headers: dict):
    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(f"/api/v1/books/{book_id}/exports", headers=auth_headers)
    assert "Prológus" in resp.text
    assert "Az indulás" in resp.text
    # Structural: chapters are H2 *lines* (numbered). Exact-line match catches a
    # heading-level mutation (H2->H1 or H2->H3).
    lines = resp.text.splitlines()
    assert "## 1. Prológus" in lines
    assert "## 2. Az indulás" in lines


async def test_export_contains_scene_content(client: AsyncClient, auth_headers: dict):
    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(f"/api/v1/books/{book_id}/exports", headers=auth_headers)
    assert "A nap felkelt." in resp.text
    assert "A hős lóra szállt." in resp.text
    # Structural: scenes are H3 *lines* (chapter.scene numbered). Exact-line
    # match catches a heading-level mutation (H3->H2 or H3->H4).
    lines = resp.text.splitlines()
    assert "### 1.1 Reggel" in lines
    assert "### 2.1 Utazás" in lines


async def test_export_marks_empty_scenes(client: AsyncClient, auth_headers: dict):
    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(f"/api/v1/books/{book_id}/exports", headers=auth_headers)
    assert "[üres jelenet]" in resp.text


async def test_export_has_content_disposition_header(client: AsyncClient, auth_headers: dict):
    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(f"/api/v1/books/{book_id}/exports", headers=auth_headers)
    assert "attachment" in resp.headers.get("content-disposition", "")
    assert ".md" in resp.headers.get("content-disposition", "")


async def test_export_excludes_archived_scenes(client: AsyncClient, auth_headers: dict):
    proj = (await client.post("/api/v1/projects", json={"title": "P"}, headers=auth_headers)).json()
    book = (await client.post(f"/api/v1/projects/{proj['id']}/books", json={"title": "Könyv"}, headers=auth_headers)).json()
    ch = (await client.post(f"/api/v1/books/{book['id']}/chapters", json={"title": "Ch"}, headers=auth_headers)).json()
    # A non-archived scene that MUST remain, plus an archived one that must vanish.
    await client.post(f"/api/v1/chapters/{ch['id']}/scenes", json={"title": "Megmaradó", "content": "Látható tartalom", "order_index": 0}, headers=auth_headers)
    s = (await client.post(f"/api/v1/chapters/{ch['id']}/scenes", json={"title": "Archiválandó", "content": "Titkos tartalom", "order_index": 1}, headers=auth_headers)).json()
    await client.post(f"/api/v1/chapters/{ch['id']}/scenes/{s['id']}/archive", headers=auth_headers)

    resp = await client.post(f"/api/v1/books/{book['id']}/exports", headers=auth_headers)
    # Archived scene excluded …
    assert "Titkos tartalom" not in resp.text
    assert "Archiválandó" not in resp.text
    # … but the non-archived scene IS present (a mutation excluding ALL scenes is caught).
    assert "Látható tartalom" in resp.text
    assert "Megmaradó" in resp.text


async def test_export_book_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(f"/api/v1/books/{uuid.uuid4()}/exports", headers=auth_headers)
    assert resp.status_code == 404


async def test_export_requires_auth(client: AsyncClient):
    resp = await client.post(f"/api/v1/books/{uuid.uuid4()}/exports")
    assert resp.status_code == 401


async def test_export_contains_metadata(client: AsyncClient, auth_headers: dict):
    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(f"/api/v1/books/{book_id}/exports", headers=auth_headers)
    assert "Fantasy" in resp.text
    assert "80000" in resp.text


async def test_export_empty_book(client: AsyncClient, auth_headers: dict):
    """Export a book with no chapters should still return valid markdown."""
    proj = (await client.post("/api/v1/projects", json={"title": "P"}, headers=auth_headers)).json()
    book = (await client.post(f"/api/v1/projects/{proj['id']}/books", json={"title": "Üres könyv"}, headers=auth_headers)).json()
    resp = await client.post(f"/api/v1/books/{book['id']}/exports", headers=auth_headers)
    assert resp.status_code == 200
    assert "Üres könyv" in resp.text


# --- Scope (P1.3): book / chapter / scene --------------------------------- #


async def test_export_book_scope_is_default(client: AsyncClient, auth_headers: dict):
    """scope omitted == whole-book export (unchanged behaviour)."""
    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports?scope=book", headers=auth_headers
    )
    assert resp.status_code == 200
    # Whole book: both chapters present.
    assert "Prológus" in resp.text
    assert "Az indulás" in resp.text


async def test_export_chapter_scope_only_that_chapter(client: AsyncClient, auth_headers: dict):
    book_id, ch1_id, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports?scope=chapter&target_id={ch1_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert "text/markdown" in resp.headers["content-type"]
    # Chapter 1 + its scene content present; chapter 2 absent.
    assert "Prológus" in resp.text
    assert "A nap felkelt." in resp.text
    assert "Az indulás" not in resp.text
    assert "A hős lóra szállt." not in resp.text
    # Filename slug derives from the chapter title.
    assert "Prol" in resp.headers.get("content-disposition", "")


async def test_export_scene_scope_returns_only_that_scene(client: AsyncClient, auth_headers: dict):
    book_id, ch1_id, _ = await _build_book(client, auth_headers)
    scenes = (await client.get(f"/api/v1/chapters/{ch1_id}/scenes", headers=auth_headers)).json()
    scene = next(s for s in scenes if s["title"] == "Reggel")
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports?scope=scene&target_id={scene['id']}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    # The scene title + content; no chapter heading, no other scene.
    assert "Reggel" in resp.text
    assert "A nap felkelt." in resp.text
    assert "Prológus" not in resp.text
    assert "Utazás" not in resp.text


async def test_export_chapter_scope_requires_target_id(client: AsyncClient, auth_headers: dict):
    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports?scope=chapter", headers=auth_headers
    )
    assert resp.status_code == 422


async def test_export_scene_scope_requires_target_id(client: AsyncClient, auth_headers: dict):
    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports?scope=scene", headers=auth_headers
    )
    assert resp.status_code == 422


async def test_export_chapter_scope_wrong_book_is_404(client: AsyncClient, auth_headers: dict):
    """A chapter that belongs to a DIFFERENT book must not be exportable here."""
    _, ch_a, _ = await _build_book(client, auth_headers)
    book_b, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_b}/exports?scope=chapter&target_id={ch_a}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_export_scene_scope_wrong_book_is_404(client: AsyncClient, auth_headers: dict):
    _, ch_a, _ = await _build_book(client, auth_headers)
    book_b, _, _ = await _build_book(client, auth_headers)
    scenes = (await client.get(f"/api/v1/chapters/{ch_a}/scenes", headers=auth_headers)).json()
    scene_id = scenes[0]["id"]
    resp = await client.post(
        f"/api/v1/books/{book_b}/exports?scope=scene&target_id={scene_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_export_chapter_scope_unknown_target_is_404(client: AsyncClient, auth_headers: dict):
    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports?scope=chapter&target_id={uuid.uuid4()}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


# --- Format (#2a): md (native) / docx / epub via pandoc -------------------- #
#
# These mock the pandoc util at the endpoint's import boundary so they run WITH
# OR WITHOUT pandoc installed. The real md->docx/epub conversion is covered by
# the pandoc-gated round-trip in tests/unit/test_pandoc.py (skips locally).


async def test_export_format_md_is_default_and_unchanged(
    client: AsyncClient, auth_headers: dict
):
    """format omitted == native Markdown (existing behaviour, text body)."""
    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports", headers=auth_headers
    )
    assert resp.status_code == 200
    assert "text/markdown" in resp.headers["content-type"]
    assert "Az elveszett királyság" in resp.text


async def test_export_format_md_explicit_unchanged(
    client: AsyncClient, auth_headers: dict
):
    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports?format=md", headers=auth_headers
    )
    assert resp.status_code == 200
    assert "text/markdown" in resp.headers["content-type"]
    assert "Prológus" in resp.text


async def test_export_format_docx_media_type_and_filename(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    """format=docx -> docx media type + .docx filename; pandoc gets the Markdown."""
    seen = {}

    def fake_convert(markdown, target, *, title=None):
        seen["markdown"] = markdown
        seen["target"] = target
        seen["title"] = title
        return b"PKfake-docx"

    monkeypatch.setattr(
        "app.api.v1.exports.convert_markdown", fake_convert
    )

    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports?format=docx", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == DOCX_MEDIA_TYPE
    assert ".docx" in resp.headers.get("content-disposition", "")
    assert resp.content == b"PKfake-docx"
    # The endpoint reused the native Markdown generator + passed the book title.
    assert seen["target"] == "docx"
    assert "Az elveszett királyság" in seen["markdown"]
    assert seen["title"] == "Az elveszett királyság"


async def test_export_format_epub_media_type_and_filename(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    def fake_convert(markdown, target, *, title=None):
        return b"PKfake-epub"

    monkeypatch.setattr(
        "app.api.v1.exports.convert_markdown", fake_convert
    )

    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports?format=epub", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == EPUB_MEDIA_TYPE
    assert ".epub" in resp.headers.get("content-disposition", "")
    assert resp.content == b"PKfake-epub"


async def test_export_format_pdf_media_type_and_filename(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    """format=pdf -> application/pdf media type + .pdf filename; pandoc gets MD."""
    seen = {}

    def fake_convert(markdown, target, *, title=None):
        seen["markdown"] = markdown
        seen["target"] = target
        seen["title"] = title
        return b"%PDF-1.7 fake"

    monkeypatch.setattr("app.api.v1.exports.convert_markdown", fake_convert)

    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports?format=pdf", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == PDF_MEDIA_TYPE
    assert ".pdf" in resp.headers.get("content-disposition", "")
    assert resp.content == b"%PDF-1.7 fake"
    # The endpoint reused the native Markdown generator + passed the book title.
    assert seen["target"] == "pdf"
    assert "Az elveszett királyság" in seen["markdown"]
    assert seen["title"] == "Az elveszett királyság"


async def test_export_pdf_engine_missing_is_503(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    """PDF engine not installed -> 503 actionable error (not 500, not empty)."""
    from app.services.pandoc import PdfEngineUnavailableError

    def boom(markdown, target, *, title=None):
        raise PdfEngineUnavailableError(
            "PDF export requires the 'weasyprint' engine; not available."
        )

    monkeypatch.setattr("app.api.v1.exports.convert_markdown", boom)

    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports?format=pdf", headers=auth_headers
    )
    assert resp.status_code == 503
    assert "weasyprint" in resp.json()["detail"].lower()


async def test_export_pdf_pandoc_failure_is_502_sanitized(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    """A pandoc PDF conversion failure -> 502 with a sanitized message."""
    from app.services.pandoc import PandocConversionError

    def boom(markdown, target, *, title=None):
        raise PandocConversionError("pandoc failed to produce PDF: <path> bad")

    monkeypatch.setattr("app.api.v1.exports.convert_markdown", boom)

    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports?format=pdf", headers=auth_headers
    )
    assert resp.status_code == 502
    assert "pandoc" in resp.json()["detail"].lower()


async def test_export_docx_chapter_scope_uses_chapter_title(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    seen = {}

    def fake_convert(markdown, target, *, title=None):
        seen["title"] = title
        seen["markdown"] = markdown
        return b"PKch"

    monkeypatch.setattr("app.api.v1.exports.convert_markdown", fake_convert)

    book_id, ch1_id, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports?scope=chapter&target_id={ch1_id}&format=docx",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == DOCX_MEDIA_TYPE
    assert seen["title"] == "Prológus"
    assert "Prológus" in seen["markdown"]
    assert "Az indulás" not in seen["markdown"]


async def test_export_docx_pandoc_missing_is_503(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    """pandoc not installed -> 503 actionable error (not 500, not empty body)."""
    from app.services.pandoc import PandocUnavailableError

    def boom(markdown, target, *, title=None):
        raise PandocUnavailableError(
            "DOCX/EPUB export requires pandoc; not available on this server."
        )

    monkeypatch.setattr("app.api.v1.exports.convert_markdown", boom)

    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports?format=docx", headers=auth_headers
    )
    assert resp.status_code == 503
    assert "pandoc" in resp.json()["detail"].lower()


async def test_export_epub_pandoc_failure_is_502_sanitized(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    """pandoc non-zero exit -> 502 with a sanitized message (no raw traceback)."""
    from app.services.pandoc import PandocConversionError

    def boom(markdown, target, *, title=None):
        raise PandocConversionError(
            "pandoc failed to produce EPUB: <path> bad input"
        )

    monkeypatch.setattr("app.api.v1.exports.convert_markdown", boom)

    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports?format=epub", headers=auth_headers
    )
    assert resp.status_code == 502
    assert "pandoc" in resp.json()["detail"].lower()


async def test_export_docx_chapter_wrong_book_is_404_before_pandoc(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    """Ownership (IDOR) is enforced for docx too: convert is never reached."""
    called = {"n": 0}

    def fake_convert(markdown, target, *, title=None):
        called["n"] += 1
        return b"PK"

    monkeypatch.setattr("app.api.v1.exports.convert_markdown", fake_convert)

    _, ch_a, _ = await _build_book(client, auth_headers)
    book_b, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_b}/exports?scope=chapter&target_id={ch_a}&format=docx",
        headers=auth_headers,
    )
    assert resp.status_code == 404
    assert called["n"] == 0


async def test_export_scene_wrong_book_is_404_for_epub(
    client: AsyncClient, auth_headers: dict, monkeypatch
):
    monkeypatch.setattr(
        "app.api.v1.exports.convert_markdown",
        lambda markdown, target, *, title=None: b"PK",
    )
    _, ch_a, _ = await _build_book(client, auth_headers)
    book_b, _, _ = await _build_book(client, auth_headers)
    scenes = (
        await client.get(f"/api/v1/chapters/{ch_a}/scenes", headers=auth_headers)
    ).json()
    resp = await client.post(
        f"/api/v1/books/{book_b}/exports?scope=scene&target_id={scenes[0]['id']}&format=epub",
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_export_invalid_format_is_422(client: AsyncClient, auth_headers: dict):
    """An unknown format value is rejected by the Literal query validation."""
    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(
        f"/api/v1/books/{book_id}/exports?format=rtf", headers=auth_headers
    )
    assert resp.status_code == 422
