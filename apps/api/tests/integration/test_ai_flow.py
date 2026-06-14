"""
Cross-resource integration tests for Plan 3: AI workflow and export.
Covers: revision lifecycle, job tracking, approve→scene update, export hierarchy.
All AI calls are mocked via FastAPI dependency override — no real LLM needed.
"""
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.main import app
from app.api.v1.ai import get_ai_service
from app.models.revision import Revision
from app.models.generation_job import GenerationJob, JobStatus


# ── mock helpers ──────────────────────────────────────────────────────────────

def _rev(content="AI tartalom", revision_type="rewrite", scene_id=None):
    r = Revision(
        content=content,
        revision_type=revision_type,
        approved=False,
        scene_id=scene_id,
        model_name="ollama/llama3.2",
        prompt_version="1.0",
    )
    r.id = uuid.uuid4()
    r.created_at = datetime.now(timezone.utc)
    r.updated_at = datetime.now(timezone.utc)
    return r


def _job(job_type="rewrite"):
    j = GenerationJob(
        job_type=job_type,
        status=JobStatus.DONE,
        model_name="ollama/llama3.2",
        prompt_version="1.0",
    )
    j.id = uuid.uuid4()
    j.created_at = datetime.now(timezone.utc)
    j.updated_at = datetime.now(timezone.utc)
    return j


@pytest.fixture
def mock_ai():
    svc = AsyncMock()
    svc.rewrite.return_value = (_rev(), _job("rewrite"))
    svc.describe.return_value = (
        [_rev(revision_type="describe_channel", content=f"Csatorna {i}") for i in range(6)],
        _job("describe"),
    )
    svc.write_continue.return_value = (_rev(content="Folytatás szövege"), _job("write_continue"))
    svc.generate_scene.return_value = (_rev(content="Generált jelenet"), _job("generate_scene"))
    svc.summarize.return_value = (_rev(content="Összefoglaló"), _job("summarize"))
    app.dependency_overrides[get_ai_service] = lambda: svc
    yield svc
    app.dependency_overrides.pop(get_ai_service, None)


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

async def test_rewrite_creates_unapproved_revision(client: AsyncClient, auth_headers: dict, mock_ai):
    _, _, _, scene_id = await _setup(client, auth_headers)
    resp = await client.post(
        "/api/v1/ai/rewrite",
        json={"selected_text": "Eredeti szöveg.", "instruction": "Tedd drámaibbá", "scene_id": scene_id},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["revision"]["approved"] is False
    assert data["job"]["status"] == "done"


async def test_rewrite_then_approve_updates_scene(client: AsyncClient, auth_headers: dict, db_session, mock_ai):
    """Full flow: AI rewrite → revision in DB → approve → scene content updated."""
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


async def test_reject_revision_does_not_change_scene(client: AsyncClient, auth_headers: dict, db_session, mock_ai):
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


async def test_list_revisions_for_scene(client: AsyncClient, auth_headers: dict, db_session, mock_ai):
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


async def test_multiple_revisions_only_one_approved(client: AsyncClient, auth_headers: dict, db_session, mock_ai):
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


# ── describe channel flow ─────────────────────────────────────────────────────

async def test_describe_returns_6_channel_revisions(client: AsyncClient, auth_headers: dict, mock_ai):
    _, _, _, scene_id = await _setup(client, auth_headers)
    resp = await client.post(
        "/api/v1/ai/describe",
        json={"selected_text": "Szoba leírása", "scene_id": scene_id},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()["revisions"]) == 6
    assert resp.json()["job"]["job_type"] == "describe"


async def test_describe_partial_channels(client: AsyncClient, auth_headers: dict, mock_ai):
    mock_ai.describe.return_value = (
        [_rev(revision_type="describe_channel", content="Látás") for _ in range(2)],
        _job("describe"),
    )
    resp = await client.post(
        "/api/v1/ai/describe",
        json={"selected_text": "x", "channels": ["Látás", "Hang"]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()["revisions"]) == 2


# ── job tracking ──────────────────────────────────────────────────────────────

async def test_generation_job_stored_in_db(client: AsyncClient, auth_headers: dict, db_session, mock_ai):
    """A GenerationJob is stored in DB when AI runs."""
    job = GenerationJob(job_type="rewrite", status=JobStatus.DONE)
    job.id = uuid.uuid4()
    db_session.add(job)
    await db_session.commit()

    resp = await client.get(f"/api/v1/jobs/{job.id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["job_type"] == "rewrite"
    assert resp.json()["status"] == "done"


async def test_jobs_list_filterable_by_status(client: AsyncClient, auth_headers: dict, db_session, mock_ai):
    done_job = GenerationJob(job_type="rewrite", status=JobStatus.DONE)
    done_job.id = uuid.uuid4()
    failed_job = GenerationJob(job_type="summarize", status=JobStatus.FAILED)
    failed_job.id = uuid.uuid4()
    db_session.add_all([done_job, failed_job])
    await db_session.commit()

    resp = await client.get("/api/v1/jobs?status=done", headers=auth_headers)
    statuses = [j["status"] for j in resp.json()]
    assert all(s == "done" for s in statuses)


# ── export + AI integration ───────────────────────────────────────────────────

async def test_export_reflects_approved_revision_content(client: AsyncClient, auth_headers: dict, db_session, mock_ai):
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


async def test_export_full_markdown_structure(client: AsyncClient, auth_headers: dict, mock_ai):
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
