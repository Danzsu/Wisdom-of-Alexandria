"""Integration tests for GenerationJob read endpoints."""
import uuid

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


async def test_list_jobs_returns_list(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/jobs", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_list_jobs_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/jobs")
    assert resp.status_code == 401


async def test_get_job_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.get(f"/api/v1/jobs/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_get_job_requires_auth(client: AsyncClient):
    resp = await client.get(f"/api/v1/jobs/{uuid.uuid4()}")
    assert resp.status_code == 401


async def test_delete_job_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.delete(f"/api/v1/jobs/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_delete_job_requires_auth(client: AsyncClient):
    resp = await client.delete(f"/api/v1/jobs/{uuid.uuid4()}")
    assert resp.status_code == 401


async def test_list_jobs_returns_created_job(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    from alexandria_core.models.generation_job import GenerationJob

    job = GenerationJob(job_type="rewrite", status="done")
    db_session.add(job)
    await db_session.commit()

    resp = await client.get("/api/v1/jobs", headers=auth_headers)
    assert resp.status_code == 200
    ids = [j["id"] for j in resp.json()]
    assert str(job.id) in ids


async def test_get_job_by_id(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    from alexandria_core.models.generation_job import GenerationJob

    job = GenerationJob(job_type="generate_scene", status="pending", model_name="ollama/llama3")
    db_session.add(job)
    await db_session.commit()

    resp = await client.get(f"/api/v1/jobs/{job.id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == str(job.id)
    assert data["job_type"] == "generate_scene"
    assert data["status"] == "pending"
    assert data["model_name"] == "ollama/llama3"


async def test_list_jobs_filter_by_status(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    from alexandria_core.models.generation_job import GenerationJob

    job_done = GenerationJob(job_type="rewrite", status="done")
    job_pending = GenerationJob(job_type="summarize", status="pending")
    db_session.add(job_done)
    db_session.add(job_pending)
    await db_session.commit()

    resp = await client.get("/api/v1/jobs?status=done", headers=auth_headers)
    assert resp.status_code == 200
    statuses = [j["status"] for j in resp.json()]
    assert all(s == "done" for s in statuses)
    assert str(job_done.id) in [j["id"] for j in resp.json()]
    assert str(job_pending.id) not in [j["id"] for j in resp.json()]


async def test_list_jobs_filter_by_scene_id(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    from alexandria_core.models.generation_job import GenerationJob

    # ``list_jobs`` filters by the ``scene_id`` column (no FK join in the query),
    # but generation_jobs.scene_id IS a real FK to scenes — so a synthetic UUID
    # violates the constraint on PostgreSQL (SQLite has FKs off by default). Seed
    # a real scene; the filter behaviour is identical, just FK-valid everywhere.
    _book, _chapter, scene = await _seed_book(db_session, "Szuro")
    scene_id = scene.id

    job_with_scene = GenerationJob(job_type="rewrite", status="done", scene_id=scene_id)
    job_without_scene = GenerationJob(job_type="summarize", status="done")
    db_session.add(job_with_scene)
    db_session.add(job_without_scene)
    await db_session.commit()

    resp = await client.get(f"/api/v1/jobs?scene_id={scene_id}", headers=auth_headers)
    assert resp.status_code == 200
    ids = [j["id"] for j in resp.json()]
    assert str(job_with_scene.id) in ids
    assert str(job_without_scene.id) not in ids


async def test_delete_job(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    from alexandria_core.models.generation_job import GenerationJob

    job = GenerationJob(job_type="rewrite", status="failed")
    db_session.add(job)
    await db_session.commit()
    job_id = str(job.id)

    del_resp = await client.delete(f"/api/v1/jobs/{job_id}", headers=auth_headers)
    assert del_resp.status_code == 204

    get_resp = await client.get(f"/api/v1/jobs/{job_id}", headers=auth_headers)
    assert get_resp.status_code == 404


async def test_job_read_schema_fields(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    from alexandria_core.models.generation_job import GenerationJob

    job = GenerationJob(
        job_type="describe",
        status="done",
        model_name="gemini/gemini-pro",
        prompt_version="v1.0",
        input_data={"scene_id": "abc"},
        output_data={"result": "ok"},
    )
    db_session.add(job)
    await db_session.commit()

    resp = await client.get(f"/api/v1/jobs/{job.id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "id" in data
    assert "scene_id" in data
    assert "chapter_id" in data
    assert "job_type" in data
    assert "status" in data
    assert "model_name" in data
    assert "prompt_version" in data
    assert "input_data" in data
    assert "output_data" in data
    assert "error_message" in data
    assert "created_at" in data
    assert "updated_at" in data
    assert data["input_data"] == {"scene_id": "abc"}
    assert data["output_data"] == {"result": "ok"}


# ---------------------------------------------------------------------------
# B1 — book_id scoping + bounded limit (live AI-feladatok screen / nav badge).
# ---------------------------------------------------------------------------


async def _seed_book(db_session: AsyncSession, title: str):
    """Create a Project → Book → Chapter → Scene chain and return them.

    The AI service shares the alexandria_core domain models, so a real
    book/chapter/scene chain is seeded directly (no apps/api round-trip) to
    exercise the book-scoping join exactly as production would.
    """
    from alexandria_core.models.book import Book
    from alexandria_core.models.chapter import Chapter
    from alexandria_core.models.project import Project
    from alexandria_core.models.scene import Scene

    project = Project(title=f"{title} projekt")
    db_session.add(project)
    await db_session.flush()
    book = Book(project_id=project.id, title=title)
    db_session.add(book)
    await db_session.flush()
    chapter = Chapter(book_id=book.id, title=f"{title} fejezet")
    db_session.add(chapter)
    await db_session.flush()
    scene = Scene(chapter_id=chapter.id, title=f"{title} jelenet")
    db_session.add(scene)
    await db_session.flush()
    return book, chapter, scene


async def test_list_jobs_filter_by_book_id_via_scene(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    from alexandria_core.models.generation_job import GenerationJob

    book_a, _chapter_a, scene_a = await _seed_book(db_session, "A könyv")
    _book_b, _chapter_b, scene_b = await _seed_book(db_session, "B könyv")

    job_a = GenerationJob(job_type="rewrite", status="done", scene_id=scene_a.id)
    job_b = GenerationJob(job_type="rewrite", status="done", scene_id=scene_b.id)
    db_session.add(job_a)
    db_session.add(job_b)
    await db_session.commit()

    resp = await client.get(
        f"/api/v1/jobs?book_id={book_a.id}", headers=auth_headers
    )
    assert resp.status_code == 200
    ids = [j["id"] for j in resp.json()]
    assert str(job_a.id) in ids
    # A job from the OTHER book must never leak into the scoped result.
    assert str(job_b.id) not in ids


async def test_list_jobs_filter_by_book_id_via_chapter(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    from alexandria_core.models.generation_job import GenerationJob

    book_a, chapter_a, _scene_a = await _seed_book(db_session, "Cs könyv")
    _book_b, chapter_b, _scene_b = await _seed_book(db_session, "Ds könyv")

    # Jobs attached by chapter_id (no scene) — the OR branch of the scoping.
    job_a = GenerationJob(
        job_type="summarize", status="done", chapter_id=chapter_a.id
    )
    job_b = GenerationJob(
        job_type="summarize", status="done", chapter_id=chapter_b.id
    )
    db_session.add(job_a)
    db_session.add(job_b)
    await db_session.commit()

    resp = await client.get(
        f"/api/v1/jobs?book_id={book_a.id}", headers=auth_headers
    )
    assert resp.status_code == 200
    ids = [j["id"] for j in resp.json()]
    assert str(job_a.id) in ids
    assert str(job_b.id) not in ids


async def test_list_jobs_book_id_excludes_orphan_jobs(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    from alexandria_core.models.generation_job import GenerationJob

    book_a, _chapter_a, scene_a = await _seed_book(db_session, "E könyv")

    job_in_book = GenerationJob(
        job_type="rewrite", status="done", scene_id=scene_a.id
    )
    # A job with neither scene nor chapter belongs to no book → excluded.
    job_orphan = GenerationJob(job_type="rewrite", status="done")
    db_session.add(job_in_book)
    db_session.add(job_orphan)
    await db_session.commit()

    resp = await client.get(
        f"/api/v1/jobs?book_id={book_a.id}", headers=auth_headers
    )
    assert resp.status_code == 200
    ids = [j["id"] for j in resp.json()]
    assert str(job_in_book.id) in ids
    assert str(job_orphan.id) not in ids


async def test_list_jobs_book_id_combines_with_status(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    from alexandria_core.models.generation_job import GenerationJob

    book_a, _chapter_a, scene_a = await _seed_book(db_session, "F könyv")

    job_failed = GenerationJob(
        job_type="rewrite", status="failed", scene_id=scene_a.id
    )
    job_done = GenerationJob(
        job_type="rewrite", status="done", scene_id=scene_a.id
    )
    db_session.add(job_failed)
    db_session.add(job_done)
    await db_session.commit()

    resp = await client.get(
        f"/api/v1/jobs?book_id={book_a.id}&status=failed", headers=auth_headers
    )
    assert resp.status_code == 200
    ids = [j["id"] for j in resp.json()]
    assert str(job_failed.id) in ids
    assert str(job_done.id) not in ids


async def test_list_jobs_limit_caps_results(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    from alexandria_core.models.generation_job import GenerationJob

    for _ in range(5):
        db_session.add(GenerationJob(job_type="rewrite", status="done"))
    await db_session.commit()

    resp = await client.get("/api/v1/jobs?limit=3", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 3


async def test_list_jobs_limit_out_of_range_rejected(
    client: AsyncClient, auth_headers: dict
):
    # Below the floor and above the ceiling both fail validation (422).
    too_small = await client.get("/api/v1/jobs?limit=0", headers=auth_headers)
    assert too_small.status_code == 422
    too_large = await client.get("/api/v1/jobs?limit=201", headers=auth_headers)
    assert too_large.status_code == 422


async def test_list_jobs_ordered_newest_first(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    import datetime

    from alexandria_core.models.generation_job import GenerationJob

    older = GenerationJob(
        job_type="rewrite",
        status="done",
        created_at=datetime.datetime(2026, 1, 1, 12, 0, 0),
    )
    newer = GenerationJob(
        job_type="rewrite",
        status="done",
        created_at=datetime.datetime(2026, 6, 1, 12, 0, 0),
    )
    db_session.add(older)
    db_session.add(newer)
    await db_session.commit()

    resp = await client.get("/api/v1/jobs", headers=auth_headers)
    assert resp.status_code == 200
    ids = [j["id"] for j in resp.json()]
    # The newer job appears before the older one (created_at desc).
    assert ids.index(str(newer.id)) < ids.index(str(older.id))
