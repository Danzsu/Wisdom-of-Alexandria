"""Cross-resource integration tests for the domain side of the AI workflow.

Covers the human-in-the-loop + export side that lives in ``apps/api``: approving
a Revision applies its content to the Scene (and counts visible words), rejecting
leaves the Scene untouched, revisions are listable per scene, only the approved
revision wins, and export reflects approved content.

The AI generation endpoints themselves (``/ai/*``) and generation-job reads
(``/jobs``) moved to ``apps/ai`` and are covered by that service's suite. These
tests need no LLM and no AI service — they write Revision rows directly and drive
only the domain (revisions / scenes / exports) endpoints.
"""
import uuid

from alexandria_core.models.revision import Revision
from httpx import AsyncClient

# ── setup helpers ─────────────────────────────────────────────────────────────

async def _setup(client, auth_headers):
    """Create project → book → chapter → scene with content."""
    proj = (await client.post("/api/v1/projects", json={"title": "P"}, headers=auth_headers)).json()
    book = (await client.post(f"/api/v1/projects/{proj['id']}/books", json={"title": "B"}, headers=auth_headers)).json()
    ch = (await client.post(f"/api/v1/books/{book['id']}/chapters", json={"title": "Ch"}, headers=auth_headers)).json()
    scene = (await client.post(
        f"/api/v1/chapters/{ch['id']}/scenes",
        json={"title": "S", "content": "Eredeti szöveg."},
        headers=auth_headers,
    )).json()
    return proj["id"], book["id"], ch["id"], scene["id"]


# ── revision lifecycle ────────────────────────────────────────────────────────

async def test_rewrite_then_approve_updates_scene(client: AsyncClient, auth_headers: dict, db_session):
    """Full flow: revision in DB → approve → scene content updated."""
    _, _, ch_id, scene_id = await _setup(client, auth_headers)

    new_content = "A vihar közeledett, az ég elsötétült."
    rev = Revision(
        scene_id=uuid.UUID(scene_id),
        content=new_content,
        approved=False,
        revision_type="rewrite",
        model_name="ollama/llama3.2",
        prompt_version="1.0",
    )
    db_session.add(rev)
    await db_session.commit()

    approve_resp = await client.post(f"/api/v1/revisions/{rev.id}/approve", headers=auth_headers)
    assert approve_resp.status_code == 200
    assert approve_resp.json()["approved"] is True

    scene_resp = await client.get(f"/api/v1/chapters/{ch_id}/scenes/{scene_id}", headers=auth_headers)
    assert scene_resp.json()["content"] == new_content
    assert scene_resp.json()["word_count"] > 0


async def test_reject_revision_does_not_change_scene(client: AsyncClient, auth_headers: dict, db_session):
    """Rejecting a revision leaves scene content unchanged."""
    _, _, ch_id, scene_id = await _setup(client, auth_headers)

    original_content = "Eredeti szöveg."
    rev = Revision(
        scene_id=uuid.UUID(scene_id),
        content="Visszautasított szöveg.",
        approved=False,
        revision_type="rewrite",
        model_name="ollama/llama3.2",
        prompt_version="1.0",
    )
    db_session.add(rev)
    await db_session.commit()

    reject_resp = await client.post(f"/api/v1/revisions/{rev.id}/reject", headers=auth_headers)
    assert reject_resp.status_code == 200
    assert reject_resp.json()["approved"] is False

    scene_resp = await client.get(f"/api/v1/chapters/{ch_id}/scenes/{scene_id}", headers=auth_headers)
    assert scene_resp.json()["content"] == original_content


async def test_list_revisions_for_scene(client: AsyncClient, auth_headers: dict, db_session):
    """Revisions for a scene are retrievable via the revisions API."""
    _, _, _, scene_id = await _setup(client, auth_headers)

    for i in range(3):
        rev = Revision(
            scene_id=uuid.UUID(scene_id),
            content=f"Változat {i}",
            approved=False,
            revision_type="rewrite",
        )
        db_session.add(rev)
    await db_session.commit()

    resp = await client.get(f"/api/v1/revisions?scene_id={scene_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) >= 3


async def test_multiple_revisions_only_one_approved(client: AsyncClient, auth_headers: dict, db_session):
    """Can approve one revision while others remain pending."""
    _, _, ch_id, scene_id = await _setup(client, auth_headers)

    revs = []
    for i in range(3):
        rev = Revision(
            scene_id=uuid.UUID(scene_id),
            content=f"Változat {i} szövege",
            approved=False,
            revision_type="rewrite",
        )
        db_session.add(rev)
        revs.append(rev)
    await db_session.commit()

    # Approve only the middle revision
    await client.post(f"/api/v1/revisions/{revs[1].id}/approve", headers=auth_headers)

    # Scene content should be rev[1]'s content
    scene_resp = await client.get(f"/api/v1/chapters/{ch_id}/scenes/{scene_id}", headers=auth_headers)
    assert scene_resp.json()["content"] == "Változat 1 szövege"


# ── export + revision integration ─────────────────────────────────────────────

async def test_export_reflects_approved_revision_content(client: AsyncClient, auth_headers: dict, db_session):
    """After approving a revision, export reflects the new scene content."""
    _, book_id, ch_id, scene_id = await _setup(client, auth_headers)

    new_content = "A frissen jóváhagyott szöveg kerül exportálásra."
    rev = Revision(
        scene_id=uuid.UUID(scene_id),
        content=new_content,
        approved=False,
        revision_type="rewrite",
    )
    db_session.add(rev)
    await db_session.commit()

    await client.post(f"/api/v1/revisions/{rev.id}/approve", headers=auth_headers)

    export_resp = await client.post(f"/api/v1/books/{book_id}/exports", headers=auth_headers)
    assert export_resp.status_code == 200
    assert new_content in export_resp.text


async def test_export_full_markdown_structure(client: AsyncClient, auth_headers: dict):
    """Export produces valid Markdown with H1 for book, H2 for chapters, H3 for scenes."""
    proj = (await client.post("/api/v1/projects", json={"title": "P"}, headers=auth_headers)).json()
    book = (await client.post(
        f"/api/v1/projects/{proj['id']}/books",
        json={"title": "Tűz és víz", "genre": "Fantasy"},
        headers=auth_headers,
    )).json()
    ch = (await client.post(f"/api/v1/books/{book['id']}/chapters", json={"title": "Az első nap"}, headers=auth_headers)).json()
    await client.post(
        f"/api/v1/chapters/{ch['id']}/scenes",
        json={"title": "Hajnal", "content": "Felkelt a nap."},
        headers=auth_headers,
    )

    resp = await client.post(f"/api/v1/books/{book['id']}/exports", headers=auth_headers)
    md = resp.text

    assert "# Tűz és víz" in md
    assert "## 1. Az első nap" in md
    assert "### 1.1 Hajnal" in md
    assert "Felkelt a nap." in md
    assert "Fantasy" in md
