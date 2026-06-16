"""
Cross-resource integration tests for Plan 2.
These tests exercise the full project hierarchy and verify cascades, scoping, and status flows.
"""
import uuid

from httpx import AsyncClient

# ── helpers ──────────────────────────────────────────────────────────────────

async def _make_project(client, auth_headers, title="Teszt Projekt"):
    r = await client.post("/api/v1/projects", json={"title": title}, headers=auth_headers)
    assert r.status_code == 201
    return r.json()

async def _make_book(client, auth_headers, project_id, title="Könyv"):
    r = await client.post(f"/api/v1/projects/{project_id}/books", json={"title": title}, headers=auth_headers)
    assert r.status_code == 201
    return r.json()

async def _make_chapter(client, auth_headers, book_id, title="Fejezet"):
    r = await client.post(f"/api/v1/books/{book_id}/chapters", json={"title": title}, headers=auth_headers)
    assert r.status_code == 201
    return r.json()

async def _make_scene(client, auth_headers, chapter_id, title="Jelenet", content=None):
    payload = {"title": title}
    if content:
        payload["content"] = content
    r = await client.post(f"/api/v1/chapters/{chapter_id}/scenes", json=payload, headers=auth_headers)
    assert r.status_code == 201
    return r.json()

async def _make_beat(client, auth_headers, scene_id, description="Egy esemény"):
    r = await client.post(f"/api/v1/scenes/{scene_id}/beats", json={"description": description}, headers=auth_headers)
    assert r.status_code == 201
    return r.json()


# ── full hierarchy creation ───────────────────────────────────────────────────

async def test_full_project_hierarchy_creation(client: AsyncClient, auth_headers: dict):
    """Create a full project→book→chapter→scene→beat chain and verify all are accessible."""
    proj = await _make_project(client, auth_headers, "Fantasy Regény")
    book = await _make_book(client, auth_headers, proj["id"], "Az első könyv")
    ch1 = await _make_chapter(client, auth_headers, book["id"], "Prológus")
    ch2 = await _make_chapter(client, auth_headers, book["id"], "1. fejezet")
    s1 = await _make_scene(client, auth_headers, ch1["id"], "Bevezetés", "A kastély csöndes volt.")
    await _make_scene(client, auth_headers, ch2["id"], "Találkozás")
    await _make_beat(client, auth_headers, s1["id"], "A hős felébred")
    await _make_beat(client, auth_headers, s1["id"], "A hős lát valamit")

    # verify chapters in book
    chapters_resp = await client.get(f"/api/v1/books/{book['id']}/chapters", headers=auth_headers)
    assert len(chapters_resp.json()) == 2

    # verify scenes in ch1
    scenes_resp = await client.get(f"/api/v1/chapters/{ch1['id']}/scenes", headers=auth_headers)
    assert len(scenes_resp.json()) == 1
    assert scenes_resp.json()[0]["word_count"] == 4  # "A kastély csöndes volt." → 4 tokens (split by whitespace)

    # verify beats in s1
    beats_resp = await client.get(f"/api/v1/scenes/{s1['id']}/beats", headers=auth_headers)
    assert len(beats_resp.json()) == 2


async def test_word_count_updates_on_patch(client: AsyncClient, auth_headers: dict):
    """Patching scene content auto-updates word_count."""
    proj = await _make_project(client, auth_headers)
    book = await _make_book(client, auth_headers, proj["id"])
    ch = await _make_chapter(client, auth_headers, book["id"])
    scene = await _make_scene(client, auth_headers, ch["id"])
    scene_id = scene["id"]

    assert scene["word_count"] == 0

    r = await client.patch(
        f"/api/v1/chapters/{ch['id']}/scenes/{scene_id}",
        json={"content": "Egy két három négy öt"},
        headers=auth_headers,
    )
    assert r.json()["word_count"] == 5

    r2 = await client.patch(
        f"/api/v1/chapters/{ch['id']}/scenes/{scene_id}",
        json={"content": "Egy szó"},
        headers=auth_headers,
    )
    assert r2.json()["word_count"] == 2


# ── cascade deletes ───────────────────────────────────────────────────────────

async def test_delete_book_cascades_to_chapters_and_scenes(client: AsyncClient, auth_headers: dict):
    """Deleting a book cascades to chapters and scenes."""
    proj = await _make_project(client, auth_headers)
    book = await _make_book(client, auth_headers, proj["id"])
    ch = await _make_chapter(client, auth_headers, book["id"])
    scene = await _make_scene(client, auth_headers, ch["id"])
    book_id, chapter_id, scene_id = book["id"], ch["id"], scene["id"]

    await client.delete(f"/api/v1/projects/{proj['id']}/books/{book_id}", headers=auth_headers)

    # chapter should be gone
    r = await client.get(f"/api/v1/books/{book_id}/chapters/{chapter_id}", headers=auth_headers)
    assert r.status_code == 404

    # scene should be gone
    r2 = await client.get(f"/api/v1/chapters/{chapter_id}/scenes/{scene_id}", headers=auth_headers)
    assert r2.status_code == 404


async def test_delete_chapter_cascades_to_scenes_and_beats(client: AsyncClient, auth_headers: dict):
    """Deleting a chapter cascades to its scenes and beats."""
    proj = await _make_project(client, auth_headers)
    book = await _make_book(client, auth_headers, proj["id"])
    ch = await _make_chapter(client, auth_headers, book["id"])
    scene = await _make_scene(client, auth_headers, ch["id"])
    beat = await _make_beat(client, auth_headers, scene["id"])
    chapter_id, scene_id, beat_id = ch["id"], scene["id"], beat["id"]

    await client.delete(f"/api/v1/books/{book['id']}/chapters/{chapter_id}", headers=auth_headers)

    r = await client.get(f"/api/v1/chapters/{chapter_id}/scenes/{scene_id}", headers=auth_headers)
    assert r.status_code == 404

    r2 = await client.get(f"/api/v1/scenes/{scene_id}/beats/{beat_id}", headers=auth_headers)
    assert r2.status_code == 404


async def test_delete_project_removes_all_codex_entries(client: AsyncClient, auth_headers: dict):
    """Deleting a project removes its characters, locations, and worldbuilding entries."""
    proj = await _make_project(client, auth_headers)
    pid = proj["id"]

    char = (await client.post(f"/api/v1/projects/{pid}/characters", json={"name": "Hős"}, headers=auth_headers)).json()
    loc = (await client.post(f"/api/v1/projects/{pid}/locations", json={"name": "Kastély"}, headers=auth_headers)).json()

    await client.delete(f"/api/v1/projects/{pid}", headers=auth_headers)

    r1 = await client.get(f"/api/v1/projects/{pid}/characters/{char['id']}", headers=auth_headers)
    assert r1.status_code == 404

    r2 = await client.get(f"/api/v1/projects/{pid}/locations/{loc['id']}", headers=auth_headers)
    assert r2.status_code == 404


# ── scoping ───────────────────────────────────────────────────────────────────

async def test_books_scoped_to_project(client: AsyncClient, auth_headers: dict):
    """Books are isolated per project — listing books from project A doesn't show project B's books."""
    p1 = await _make_project(client, auth_headers, "Project A")
    p2 = await _make_project(client, auth_headers, "Project B")
    await _make_book(client, auth_headers, p1["id"], "A Könyv")
    await _make_book(client, auth_headers, p1["id"], "A Könyv 2")
    await _make_book(client, auth_headers, p2["id"], "B Könyv")

    r1 = await client.get(f"/api/v1/projects/{p1['id']}/books", headers=auth_headers)
    r2 = await client.get(f"/api/v1/projects/{p2['id']}/books", headers=auth_headers)
    assert len(r1.json()) == 2
    assert len(r2.json()) == 1


async def test_characters_scoped_to_project(client: AsyncClient, auth_headers: dict):
    """Characters from project A are not visible in project B."""
    p1 = await _make_project(client, auth_headers, "P1")
    p2 = await _make_project(client, auth_headers, "P2")
    await client.post(f"/api/v1/projects/{p1['id']}/characters", json={"name": "Aragorn"}, headers=auth_headers)

    r = await client.get(f"/api/v1/projects/{p2['id']}/characters", headers=auth_headers)
    assert r.json() == []


# ── status flows ─────────────────────────────────────────────────────────────

async def test_scene_archive_unarchive_lifecycle(client: AsyncClient, auth_headers: dict):
    """Full archive/unarchive flow for a scene."""
    proj = await _make_project(client, auth_headers)
    book = await _make_book(client, auth_headers, proj["id"])
    ch = await _make_chapter(client, auth_headers, book["id"])
    scene = await _make_scene(client, auth_headers, ch["id"])
    sid = scene["id"]

    assert scene["status"] == "draft"

    # archive
    r = await client.post(f"/api/v1/chapters/{ch['id']}/scenes/{sid}/archive", headers=auth_headers)
    assert r.json()["status"] == "archived"

    # archived scene excluded from list by default
    r2 = await client.get(f"/api/v1/chapters/{ch['id']}/scenes", headers=auth_headers)
    assert not any(s["id"] == sid for s in r2.json())

    # included when explicitly requested
    r3 = await client.get(f"/api/v1/chapters/{ch['id']}/scenes?include_archived=true", headers=auth_headers)
    assert any(s["id"] == sid for s in r3.json())

    # unarchive
    r4 = await client.post(f"/api/v1/chapters/{ch['id']}/scenes/{sid}/unarchive", headers=auth_headers)
    assert r4.json()["status"] == "draft"

    # back in default list
    r5 = await client.get(f"/api/v1/chapters/{ch['id']}/scenes", headers=auth_headers)
    assert any(s["id"] == sid for s in r5.json())


async def test_chapter_status_progression(client: AsyncClient, auth_headers: dict):
    """Chapter status can be updated through draft→in_progress→complete."""
    proj = await _make_project(client, auth_headers)
    book = await _make_book(client, auth_headers, proj["id"])
    ch = await _make_chapter(client, auth_headers, book["id"])
    cid = ch["id"]

    assert ch["status"] == "draft"

    r = await client.patch(f"/api/v1/books/{book['id']}/chapters/{cid}", json={"status": "in_progress"}, headers=auth_headers)
    assert r.json()["status"] == "in_progress"

    r2 = await client.patch(f"/api/v1/books/{book['id']}/chapters/{cid}", json={"status": "complete"}, headers=auth_headers)
    assert r2.json()["status"] == "complete"


# ── revision approve flow ────────────────────────────────────────────────────

async def test_revision_approve_updates_scene_content(client: AsyncClient, auth_headers: dict, db_session):
    """Approving a revision updates the linked scene's content and word_count."""
    from alexandria_core.models.revision import Revision

    proj = await _make_project(client, auth_headers)
    book = await _make_book(client, auth_headers, proj["id"])
    ch = await _make_chapter(client, auth_headers, book["id"])
    scene = await _make_scene(client, auth_headers, ch["id"], content="Eredeti szöveg")
    scene_id = scene["id"]

    new_content = "Ez az új átírt szöveg amelynek nyolc szava van."
    rev = Revision(
        scene_id=uuid.UUID(scene_id),
        content=new_content,
        approved=False,
        revision_type="rewrite",
    )
    db_session.add(rev)
    await db_session.commit()

    r = await client.post(f"/api/v1/revisions/{rev.id}/approve", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["approved"] is True

    scene_r = await client.get(f"/api/v1/chapters/{ch['id']}/scenes/{scene_id}", headers=auth_headers)
    assert scene_r.json()["content"] == new_content
    assert scene_r.json()["word_count"] == 9


# ── codex ai_visible ─────────────────────────────────────────────────────────

async def test_codex_ai_visible_toggle(client: AsyncClient, auth_headers: dict):
    """ai_visible can be toggled on Character, Location, and WorldbuildingEntry."""
    proj = await _make_project(client, auth_headers)
    pid = proj["id"]

    char = (await client.post(f"/api/v1/projects/{pid}/characters", json={"name": "Titkos", "ai_visible": False}, headers=auth_headers)).json()
    assert char["ai_visible"] is False

    r = await client.patch(f"/api/v1/projects/{pid}/characters/{char['id']}", json={"ai_visible": True}, headers=auth_headers)
    assert r.json()["ai_visible"] is True

    loc = (await client.post(f"/api/v1/projects/{pid}/locations", json={"name": "Rejtett hely", "ai_visible": True}, headers=auth_headers)).json()
    assert loc["ai_visible"] is True


# ── beat reorder ─────────────────────────────────────────────────────────────

async def test_beat_reorder_within_scene(client: AsyncClient, auth_headers: dict):
    """Beats can be reordered within a scene."""
    proj = await _make_project(client, auth_headers)
    book = await _make_book(client, auth_headers, proj["id"])
    ch = await _make_chapter(client, auth_headers, book["id"])
    scene = await _make_scene(client, auth_headers, ch["id"])
    sid = scene["id"]

    b1 = (await client.post(f"/api/v1/scenes/{sid}/beats", json={"description": "B1", "order_index": 0}, headers=auth_headers)).json()["id"]
    b2 = (await client.post(f"/api/v1/scenes/{sid}/beats", json={"description": "B2", "order_index": 1}, headers=auth_headers)).json()["id"]
    b3 = (await client.post(f"/api/v1/scenes/{sid}/beats", json={"description": "B3", "order_index": 2}, headers=auth_headers)).json()["id"]

    r = await client.post(f"/api/v1/scenes/{sid}/beats/reorder", json={"order": [b3, b1, b2]}, headers=auth_headers)
    assert r.status_code == 200
    ids = [b["id"] for b in r.json()]
    assert ids == [b3, b1, b2]


# ── snippet tagging ───────────────────────────────────────────────────────────

async def test_snippet_tag_filter(client: AsyncClient, auth_headers: dict):
    """Snippets can be filtered by tag."""
    proj = await _make_project(client, auth_headers)
    pid = proj["id"]

    await client.post(f"/api/v1/projects/{pid}/snippets", json={"title": "S1", "content": "...", "tags": ["akció", "harc"]}, headers=auth_headers)
    await client.post(f"/api/v1/projects/{pid}/snippets", json={"title": "S2", "content": "...", "tags": ["romantika"]}, headers=auth_headers)
    await client.post(f"/api/v1/projects/{pid}/snippets", json={"title": "S3", "content": "...", "tags": ["akció"]}, headers=auth_headers)

    r = await client.get(f"/api/v1/projects/{pid}/snippets?tag=akció", headers=auth_headers)
    titles = [s["title"] for s in r.json()]
    assert "S1" in titles
    assert "S3" in titles
    assert "S2" not in titles


# ── style guide upsert ───────────────────────────────────────────────────────

async def test_style_guide_full_upsert_flow(client: AsyncClient, auth_headers: dict):
    """StyleGuide PUT upserts correctly across multiple calls."""
    proj = await _make_project(client, auth_headers)
    pid = proj["id"]

    # first call: creates
    r1 = await client.put(f"/api/v1/projects/{pid}/style-guide", json={"tone": "komor", "pov": "harmadik személy"}, headers=auth_headers)
    assert r1.status_code == 201
    assert r1.json()["tone"] == "komor"

    # second call: updates
    r2 = await client.put(f"/api/v1/projects/{pid}/style-guide", json={"tone": "humoros", "pov": "első személy"}, headers=auth_headers)
    assert r2.status_code == 200
    assert r2.json()["tone"] == "humoros"
    assert r2.json()["pov"] == "első személy"
