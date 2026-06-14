import uuid
import pytest
from httpx import AsyncClient


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


async def test_export_contains_chapters(client: AsyncClient, auth_headers: dict):
    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(f"/api/v1/books/{book_id}/exports", headers=auth_headers)
    assert "Prológus" in resp.text
    assert "Az indulás" in resp.text


async def test_export_contains_scene_content(client: AsyncClient, auth_headers: dict):
    book_id, _, _ = await _build_book(client, auth_headers)
    resp = await client.post(f"/api/v1/books/{book_id}/exports", headers=auth_headers)
    assert "A nap felkelt." in resp.text
    assert "A hős lóra szállt." in resp.text


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
    s = (await client.post(f"/api/v1/chapters/{ch['id']}/scenes", json={"title": "Archiválandó", "content": "Titkos tartalom"}, headers=auth_headers)).json()
    await client.post(f"/api/v1/chapters/{ch['id']}/scenes/{s['id']}/archive", headers=auth_headers)

    resp = await client.post(f"/api/v1/books/{book['id']}/exports", headers=auth_headers)
    assert "Titkos tartalom" not in resp.text


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
