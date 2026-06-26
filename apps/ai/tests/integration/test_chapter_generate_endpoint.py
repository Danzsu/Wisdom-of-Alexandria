"""POST /ai/chapters/{chapter_id}/generate — enqueue a chapter-generate job (T2).

These cover the ENQUEUE side: the endpoint must validate the chapter + the
selected scenes (every scene belongs to the chapter; every selected scene has
>=1 beat), persist a PENDING, chapter+project-scoped chapter-generate job with
the right ``input_data``, hand its id to the queue (mocked — no Redis), require
auth, and reject bad selections with a 422.
"""

import uuid
from unittest.mock import patch

import pytest
from alexandria_core.models.beat import Beat
from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.generation_job import GenerationJob, JobStatus, JobType
from alexandria_core.models.project import Project
from alexandria_core.models.scene import Scene
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def _make_chapter_with_scenes(
    db: AsyncSession, *, scene_beat_counts: list[int]
) -> tuple[uuid.UUID, uuid.UUID, list[uuid.UUID]]:
    """project→book→chapter→N scenes; scene i gets ``scene_beat_counts[i]`` beats.

    Returns ``(chapter_id, project_id, [scene_ids in order])``.
    """
    project = Project(title="Fejezet-gen projekt")
    db.add(project)
    await db.flush()
    book = Book(project_id=project.id, title="Könyv")
    db.add(book)
    await db.flush()
    chapter = Chapter(book_id=book.id, title="Fejezet")
    db.add(chapter)
    await db.flush()
    scene_ids: list[uuid.UUID] = []
    for i, beat_count in enumerate(scene_beat_counts):
        scene = Scene(chapter_id=chapter.id, title=f"Jelenet {i}", order_index=i)
        db.add(scene)
        await db.flush()
        scene_ids.append(scene.id)
        for j in range(beat_count):
            db.add(
                Beat(scene_id=scene.id, description=f"Beat {i}.{j}", order_index=j)
            )
    await db.commit()
    return chapter.id, project.id, scene_ids


@pytest.mark.integration
async def test_chapter_generate_creates_pending_job_and_enqueues(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    chapter_id, project_id, scene_ids = await _make_chapter_with_scenes(
        db_session, scene_beat_counts=[2, 1]
    )
    with patch("app.api.v1.ai.enqueue_chapter_generation_job") as mock_enqueue:
        resp = await client.post(
            f"/api/v1/ai/chapters/{chapter_id}/generate",
            json={
                "scene_ids": [str(s) for s in scene_ids],
                "run_continuity": True,
            },
            headers=auth_headers,
        )
    assert resp.status_code == 202
    data = resp.json()
    assert data["job_type"] == JobType.CHAPTER_GENERATE
    assert data["status"] == JobStatus.PENDING
    assert data["chapter_id"] == str(chapter_id)
    assert data["project_id"] == str(project_id)
    # input_data carries the selection + the continuity flag verbatim.
    assert data["input_data"]["scene_ids"] == [str(s) for s in scene_ids]
    assert data["input_data"]["run_continuity"] is True

    # Enqueued exactly once with the created job's id.
    mock_enqueue.assert_called_once()
    (enqueued_id,) = mock_enqueue.call_args.args
    assert str(enqueued_id) == data["id"]

    # Persisted as a pending chapter-generate job for the chapter + project.
    job = (
        await db_session.execute(
            select(GenerationJob).where(GenerationJob.id == uuid.UUID(data["id"]))
        )
    ).scalar_one()
    assert job.chapter_id == chapter_id
    assert job.project_id == project_id
    assert job.job_type == JobType.CHAPTER_GENERATE
    assert job.status == JobStatus.PENDING


@pytest.mark.integration
async def test_chapter_generate_persists_model_params(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    chapter_id, _project_id, scene_ids = await _make_chapter_with_scenes(
        db_session, scene_beat_counts=[1]
    )
    with patch("app.api.v1.ai.enqueue_chapter_generation_job"):
        resp = await client.post(
            f"/api/v1/ai/chapters/{chapter_id}/generate",
            json={
                "scene_ids": [str(scene_ids[0])],
                "model": "ollama/llama3.2",
                "temperature": 0.7,
                "max_tokens": 2048,
            },
            headers=auth_headers,
        )
    assert resp.status_code == 202
    job = (
        await db_session.execute(
            select(GenerationJob).where(
                GenerationJob.id == uuid.UUID(resp.json()["id"])
            )
        )
    ).scalar_one()
    assert job.input_data["model"] == "ollama/llama3.2"
    assert job.input_data["temperature"] == 0.7
    assert job.input_data["max_tokens"] == 2048
    assert job.input_data["run_continuity"] is False  # defaulted


@pytest.mark.integration
async def test_chapter_generate_empty_selection_is_422(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    chapter_id, _project_id, _scene_ids = await _make_chapter_with_scenes(
        db_session, scene_beat_counts=[1]
    )
    with patch("app.api.v1.ai.enqueue_chapter_generation_job") as mock_enqueue:
        resp = await client.post(
            f"/api/v1/ai/chapters/{chapter_id}/generate",
            json={"scene_ids": []},
            headers=auth_headers,
        )
    assert resp.status_code == 422
    mock_enqueue.assert_not_called()


@pytest.mark.integration
async def test_chapter_generate_missing_chapter_is_404(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    with patch("app.api.v1.ai.enqueue_chapter_generation_job") as mock_enqueue:
        resp = await client.post(
            f"/api/v1/ai/chapters/{uuid.uuid4()}/generate",
            json={"scene_ids": [str(uuid.uuid4())]},
            headers=auth_headers,
        )
    assert resp.status_code == 404
    mock_enqueue.assert_not_called()


@pytest.mark.integration
async def test_chapter_generate_scene_not_in_chapter_is_422(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    """A scene_id belonging to a DIFFERENT chapter must be rejected (422).

    Mutation guard: this is the test that fails if the "scene belongs to chapter"
    guard is removed.
    """
    chapter_id, _project_id, scene_ids = await _make_chapter_with_scenes(
        db_session, scene_beat_counts=[1]
    )
    # A second chapter with its own scene (with a beat, so only the cross-chapter
    # membership — not the beat guard — can reject it).
    other_chapter_id, _p2, other_scene_ids = await _make_chapter_with_scenes(
        db_session, scene_beat_counts=[1]
    )
    with patch("app.api.v1.ai.enqueue_chapter_generation_job") as mock_enqueue:
        resp = await client.post(
            f"/api/v1/ai/chapters/{chapter_id}/generate",
            json={"scene_ids": [str(scene_ids[0]), str(other_scene_ids[0])]},
            headers=auth_headers,
        )
    assert resp.status_code == 422
    mock_enqueue.assert_not_called()
    # No chapter-generate job leaked for the chapter.
    jobs = (
        await db_session.execute(
            select(GenerationJob).where(GenerationJob.chapter_id == chapter_id)
        )
    ).scalars().all()
    assert jobs == []


@pytest.mark.integration
async def test_chapter_generate_nonexistent_scene_is_422(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    """A scene_id that is a valid UUID but does NOT exist in the DB at all must be
    rejected 422 (it can't belong to the chapter) — distinct from the
    different-chapter case."""
    chapter_id, _project_id, scene_ids = await _make_chapter_with_scenes(
        db_session, scene_beat_counts=[1]
    )
    ghost_scene = uuid.uuid4()
    with patch("app.api.v1.ai.enqueue_chapter_generation_job") as mock_enqueue:
        resp = await client.post(
            f"/api/v1/ai/chapters/{chapter_id}/generate",
            json={"scene_ids": [str(scene_ids[0]), str(ghost_scene)]},
            headers=auth_headers,
        )
    assert resp.status_code == 422
    mock_enqueue.assert_not_called()
    jobs = (
        await db_session.execute(
            select(GenerationJob).where(GenerationJob.chapter_id == chapter_id)
        )
    ).scalars().all()
    assert jobs == []


@pytest.mark.integration
async def test_chapter_generate_scene_with_no_beats_is_422(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    """A selected scene with zero beats is a guard violation (the UI disables it)."""
    chapter_id, _project_id, scene_ids = await _make_chapter_with_scenes(
        db_session, scene_beat_counts=[1, 0]
    )
    with patch("app.api.v1.ai.enqueue_chapter_generation_job") as mock_enqueue:
        resp = await client.post(
            f"/api/v1/ai/chapters/{chapter_id}/generate",
            json={"scene_ids": [str(scene_ids[0]), str(scene_ids[1])]},
            headers=auth_headers,
        )
    assert resp.status_code == 422
    mock_enqueue.assert_not_called()


@pytest.mark.integration
async def test_chapter_generate_requires_auth(
    client: AsyncClient, db_session: AsyncSession
):
    resp = await client.post(
        f"/api/v1/ai/chapters/{uuid.uuid4()}/generate",
        json={"scene_ids": [str(uuid.uuid4())]},
    )
    assert resp.status_code == 401


@pytest.mark.integration
async def test_chapter_generate_enqueue_failure_marks_job_failed(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    """If enqueue raises (Redis down), the job is persisted FAILED (never stuck
    PENDING) and a sanitized 502 is returned (no broker URL/secret echoed)."""
    chapter_id, _project_id, scene_ids = await _make_chapter_with_scenes(
        db_session, scene_beat_counts=[1]
    )
    with patch(
        "app.api.v1.ai.enqueue_chapter_generation_job",
        side_effect=RuntimeError("redis://:s3cr3t-leak-xyz@broker:6379 refused"),
    ):
        resp = await client.post(
            f"/api/v1/ai/chapters/{chapter_id}/generate",
            json={"scene_ids": [str(scene_ids[0])]},
            headers=auth_headers,
        )
    assert resp.status_code == 502
    assert "s3cr3t-leak-xyz" not in resp.text
    assert "broker:6379" not in resp.text
    job = (
        await db_session.execute(
            select(GenerationJob).where(GenerationJob.chapter_id == chapter_id)
        )
    ).scalar_one()
    assert job.status == JobStatus.FAILED
