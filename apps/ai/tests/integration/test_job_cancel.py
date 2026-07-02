"""POST /api/v1/jobs/{id}/cancel — cancel a generation job.

Background (investigated): ``DELETE /jobs/{id}`` only deletes the DB row and
never touches RQ — a queued RQ job would still run (and no-op on the missing
row). Cancel is the real control surface:

  - PENDING → best-effort removal of the queued RQ job (the RQ job id equals
    the GenerationJob uuid string since the producer enqueues with
    ``job_id=str(job_id)``) + the row flips to ``cancelled``.
  - RUNNING → cooperative: the row flips to ``cancelled`` and the
    chapter-generation loop CHECKS the flag between scenes, stopping cleanly
    while KEEPING the already-generated revisions.
  - terminal (done/failed/cancelled) → 409.

The index and image jobs have a MONOLITHIC work phase (one sync_project / one
image-generation call), so their cooperative checks are (a) at ENTRY — an
already-cancelled row never starts the work — and (b) BEFORE the terminal
DONE/FAILED write — a cancel landing mid-work is never stomped. A row DELETED
mid-run is a graceful stop, never a crash.

The RQ layer is mocked throughout (no Redis).
"""

import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

import pytest
from alexandria_core.models.beat import Beat
from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.character import Character
from alexandria_core.models.generation_job import (
    GenerationJob,
    JobStatus,
    JobType,
)
from alexandria_core.models.media_asset import MediaAsset
from alexandria_core.models.project import Project
from alexandria_core.models.revision import Revision
from alexandria_core.models.scene import Scene
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.jobs.chapter_generation_job import _run_chapter_generation_job
from app.jobs.image_job import _run_image_job
from app.jobs.index_job import _run_index_job
from app.services.embedding_service import EmbeddingService, SyncResult
from app.services.image_service import ImageService

BASE = "/api/v1/jobs"


# ---------------------------------------------------------------------------
# Endpoint behaviour (RQ mocked at the route boundary).
# ---------------------------------------------------------------------------


async def _make_job(db_session: AsyncSession, status: str) -> GenerationJob:
    job = GenerationJob(job_type=JobType.CHAPTER_GENERATE, status=status)
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)
    return job


async def test_cancel_pending_job_cancels_rq_and_marks_cancelled(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    job = await _make_job(db_session, JobStatus.PENDING)

    with patch("app.api.v1.jobs.cancel_rq_job", return_value=True) as mock_cancel:
        resp = await client.post(f"{BASE}/{job.id}/cancel", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == JobStatus.CANCELLED
    mock_cancel.assert_called_once_with(job.id)

    await db_session.refresh(job)
    assert job.status == JobStatus.CANCELLED


async def test_cancel_pending_job_marks_cancelled_even_if_rq_cancel_fails(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    """A Redis hiccup / already-dequeued RQ job must not block cancellation of
    the row — the worker no-ops on a cancelled row anyway."""
    job = await _make_job(db_session, JobStatus.PENDING)

    with patch("app.api.v1.jobs.cancel_rq_job", return_value=False):
        resp = await client.post(f"{BASE}/{job.id}/cancel", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == JobStatus.CANCELLED


async def test_cancel_running_job_sets_flag_without_touching_rq(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    """A RUNNING job is already executing — removing it from the queue is
    meaningless. Cancellation is cooperative: only the flag is set."""
    job = await _make_job(db_session, JobStatus.RUNNING)

    with patch("app.api.v1.jobs.cancel_rq_job") as mock_cancel:
        resp = await client.post(f"{BASE}/{job.id}/cancel", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["status"] == JobStatus.CANCELLED
    mock_cancel.assert_not_called()


@pytest.mark.parametrize(
    "terminal", [JobStatus.DONE, JobStatus.FAILED, JobStatus.CANCELLED]
)
async def test_cancel_terminal_job_conflicts(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession, terminal: str
):
    job = await _make_job(db_session, terminal)
    with patch("app.api.v1.jobs.cancel_rq_job") as mock_cancel:
        resp = await client.post(f"{BASE}/{job.id}/cancel", headers=auth_headers)
    assert resp.status_code == 409
    mock_cancel.assert_not_called()
    await db_session.refresh(job)
    assert job.status == terminal  # untouched


async def test_cancel_job_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(f"{BASE}/{uuid.uuid4()}/cancel", headers=auth_headers)
    assert resp.status_code == 404


async def test_cancel_requires_auth(client: AsyncClient):
    resp = await client.post(f"{BASE}/{uuid.uuid4()}/cancel")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# RQ linkage — the producer must enqueue with job_id=str(GenerationJob.id) so
# a pending RQ job is addressable for cancellation.
# ---------------------------------------------------------------------------


def test_enqueue_chapter_generation_job_uses_job_uuid_as_rq_id():
    from app.services import job_queue

    job_id = uuid.uuid4()
    with patch.object(job_queue, "get_queue") as mock_get_queue:
        job_queue.enqueue_chapter_generation_job(job_id)
    mock_get_queue.return_value.enqueue.assert_called_once_with(
        job_queue.CHAPTER_GENERATION_JOB_PATH, str(job_id), job_id=str(job_id)
    )


def test_cancel_rq_job_fetches_by_uuid_and_cancels():
    from app.services import job_queue

    job_id = uuid.uuid4()
    with (
        patch.object(job_queue, "Job") as mock_job_cls,
        patch.object(job_queue, "Redis"),
    ):
        result = job_queue.cancel_rq_job(job_id)
    assert result is True
    mock_job_cls.fetch.assert_called_once()
    assert mock_job_cls.fetch.call_args.args[0] == str(job_id)
    mock_job_cls.fetch.return_value.cancel.assert_called_once()


def test_cancel_rq_job_missing_rq_job_returns_false():
    from rq.exceptions import NoSuchJobError

    from app.services import job_queue

    with (
        patch.object(job_queue, "Job") as mock_job_cls,
        patch.object(job_queue, "Redis"),
    ):
        mock_job_cls.fetch.side_effect = NoSuchJobError("gone")
        assert job_queue.cancel_rq_job(uuid.uuid4()) is False


def test_cancel_rq_job_redis_down_returns_false():
    from app.services import job_queue

    with (
        patch.object(job_queue, "Job") as mock_job_cls,
        patch.object(job_queue, "Redis"),
    ):
        mock_job_cls.fetch.side_effect = ConnectionError("redis down")
        assert job_queue.cancel_rq_job(uuid.uuid4()) is False


# ---------------------------------------------------------------------------
# Cooperative mid-run cancellation — the chapter-generation loop checks the
# flag between scenes (same no-Redis harness as test_chapter_generation_job).
# ---------------------------------------------------------------------------


def _session_factory(db_session: AsyncSession):
    @asynccontextmanager
    async def _factory():
        yield db_session

    return _factory


async def _make_chapter_job(
    db: AsyncSession, scene_count: int
) -> tuple[GenerationJob, list[uuid.UUID]]:
    project = Project(title="Cancel projekt")
    db.add(project)
    await db.flush()
    book = Book(project_id=project.id, title="Könyv")
    db.add(book)
    await db.flush()
    chapter = Chapter(book_id=book.id, title="Fejezet")
    db.add(chapter)
    await db.flush()
    scene_ids: list[uuid.UUID] = []
    for i in range(scene_count):
        scene = Scene(chapter_id=chapter.id, title=f"Jelenet {i}", order_index=i)
        db.add(scene)
        await db.flush()
        scene_ids.append(scene.id)
        db.add(Beat(scene_id=scene.id, description=f"Beat {i}", order_index=0))
    job = GenerationJob(
        chapter_id=chapter.id,
        project_id=project.id,
        job_type=JobType.CHAPTER_GENERATE,
        status=JobStatus.PENDING,
        input_data={"scene_ids": [str(s) for s in scene_ids]},
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job, scene_ids


def _ai_cancelling_after_first_scene(db_session: AsyncSession, job_id: uuid.UUID):
    """Mocked AIService: the FIRST generate call persists a real revision and
    then flips the job to CANCELLED (as the endpoint would mid-run); later calls
    would persist more revisions — the loop must never make them."""
    svc = AsyncMock()

    async def _gen(db, *, scene, beats, job_id: uuid.UUID, **kwargs):
        scene_id = getattr(scene, "id", scene)
        rev = Revision(
            content="ok",
            revision_type="generate_scene",
            approved=False,
            scene_id=scene_id,
            job_id=job_id,
        )
        db.add(rev)
        await db.flush()
        if svc.generate_scene_revision.await_count == 1:
            current = await db.get(GenerationJob, job_id)
            current.status = JobStatus.CANCELLED
            await db.commit()
        return rev, []

    svc.generate_scene_revision.side_effect = _gen
    return svc


@pytest.mark.integration
async def test_chapter_job_stops_between_scenes_on_cancel(db_session: AsyncSession):
    """Cancel lands DURING scene 1 of 3 → the loop stops BEFORE scene 2, the
    scene-1 revision is KEPT, the job ends cancelled, and output_data records
    the cancellation + the skipped scenes."""
    job, scene_ids = await _make_chapter_job(db_session, scene_count=3)
    svc = _ai_cancelling_after_first_scene(db_session, job.id)

    await _run_chapter_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.CANCELLED
    # Only the first scene ran.
    assert svc.generate_scene_revision.await_count == 1
    # Its revision is kept (completed work is never discarded).
    revs = (
        (await db_session.execute(select(Revision).where(Revision.job_id == job.id)))
        .scalars()
        .all()
    )
    assert len(revs) == 1
    assert revs[0].scene_id == scene_ids[0]
    # output_data reflects the cancellation.
    assert job.output_data["completed"] == 1
    assert job.output_data["cancelled"] is True
    assert set(job.output_data["skipped"]) == {str(s) for s in scene_ids[1:]}


@pytest.mark.integration
async def test_chapter_job_cancel_during_last_scene_stays_cancelled(
    db_session: AsyncSession,
):
    """A cancel landing during the LAST scene must not be stomped by the final
    DONE transition — the job ends cancelled (with the last revision kept)."""
    job, scene_ids = await _make_chapter_job(db_session, scene_count=1)
    svc = _ai_cancelling_after_first_scene(db_session, job.id)

    await _run_chapter_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.CANCELLED
    revs = (
        (await db_session.execute(select(Revision).where(Revision.job_id == job.id)))
        .scalars()
        .all()
    )
    assert len(revs) == 1


@pytest.mark.integration
async def test_chapter_job_already_cancelled_never_starts_work(
    db_session: AsyncSession,
):
    """A chapter job cancelled BEFORE the worker dequeues it (the best-effort
    RQ cancel raced or failed) must be a no-op: the entry must not stomp
    CANCELLED with RUNNING, and no scene generation may run at all.

    Before the fix: entry unconditionally flipped the row to RUNNING (stomping
    CANCELLED), the first between-scenes refresh read back that RUNNING, and
    the job ran to DONE."""
    job, _scene_ids = await _make_chapter_job(db_session, scene_count=2)
    job.status = JobStatus.CANCELLED
    await db_session.commit()

    svc = AsyncMock()

    await _run_chapter_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    svc.generate_scene_revision.assert_not_awaited()
    await db_session.refresh(job)
    assert job.status == JobStatus.CANCELLED


# ---------------------------------------------------------------------------
# Cooperative cancellation — INDEX job. Its work phase is one monolithic
# sync_project call, so the checks are at entry + before the terminal write.
# ---------------------------------------------------------------------------


async def _make_index_job(db: AsyncSession, status: str) -> GenerationJob:
    project = Project(title="Cancel index projekt")
    db.add(project)
    await db.flush()
    job = GenerationJob(
        project_id=project.id, job_type=JobType.INDEX, status=status
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


def _embeddings_cancelling_mid_sync(job_id: uuid.UUID):
    """Mocked EmbeddingService whose sync_project flips the job to CANCELLED
    mid-work (as the cancel endpoint would from another session) and then
    finishes normally — the terminal transition must NOT stomp it."""
    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = "openai/text-embedding-3-small"

    async def _sync(db, project_id, *, embedding_model):
        current = await db.get(GenerationJob, job_id)
        current.status = JobStatus.CANCELLED
        await db.commit()
        return SyncResult(indexed=1)

    emb.sync_project.side_effect = _sync
    return emb


@pytest.mark.integration
async def test_index_job_cancel_mid_sync_is_not_stomped_by_done(db_session):
    """Cancel lands WHILE sync_project runs → the job must end CANCELLED; the
    terminal transition must not overwrite it with DONE."""
    job = await _make_index_job(db_session, JobStatus.PENDING)
    emb = _embeddings_cancelling_mid_sync(job.id)

    await _run_index_job(
        job.id, session_factory=_session_factory(db_session), embeddings=emb
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.CANCELLED


@pytest.mark.integration
async def test_index_job_already_cancelled_never_starts_work(db_session):
    """A job cancelled BEFORE the worker dequeues it (RQ-cancel raced/failed)
    must be a no-op: no RUNNING flip, no embedding work at all."""
    job = await _make_index_job(db_session, JobStatus.CANCELLED)
    emb = AsyncMock(spec=EmbeddingService)

    await _run_index_job(
        job.id, session_factory=_session_factory(db_session), embeddings=emb
    )

    emb.resolve_embedding_model.assert_not_awaited()
    emb.sync_project.assert_not_awaited()
    await db_session.refresh(job)
    assert job.status == JobStatus.CANCELLED


@pytest.mark.integration
async def test_index_job_cancel_then_failure_stays_cancelled(db_session):
    """Cancel lands mid-work and THEN the work raises → the failure handler must
    not overwrite CANCELLED with FAILED."""
    job = await _make_index_job(db_session, JobStatus.PENDING)
    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = "openai/text-embedding-3-small"

    async def _cancel_then_boom(db, project_id, *, embedding_model):
        current = await db.get(GenerationJob, job.id)
        current.status = JobStatus.CANCELLED
        await db.commit()
        raise RuntimeError("boom mid-sync")

    emb.sync_project.side_effect = _cancel_then_boom

    await _run_index_job(
        job.id, session_factory=_session_factory(db_session), embeddings=emb
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.CANCELLED
    assert job.error_message is None  # the failed-write was skipped entirely


@pytest.mark.integration
async def test_index_job_deleted_mid_sync_is_graceful(db_session):
    """DELETE /jobs/{id} lands while sync_project runs → the run must return
    cleanly (no exception from the terminal transition on a vanished row)."""
    job = await _make_index_job(db_session, JobStatus.PENDING)
    job_id = job.id
    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = "openai/text-embedding-3-small"

    async def _delete_row(db, project_id, *, embedding_model):
        current = await db.get(GenerationJob, job_id)
        await db.delete(current)
        await db.commit()
        return SyncResult(indexed=1)

    emb.sync_project.side_effect = _delete_row

    # Must not raise.
    await _run_index_job(
        job_id, session_factory=_session_factory(db_session), embeddings=emb
    )

    assert await db_session.get(GenerationJob, job_id) is None  # stays deleted


# ---------------------------------------------------------------------------
# Cooperative cancellation — IMAGE job. Same shape as the index job: one
# monolithic generate call, checks at entry + before the terminal write.
# ---------------------------------------------------------------------------


async def _make_image_job(
    db: AsyncSession, status: str
) -> tuple[GenerationJob, uuid.UUID]:
    project = Project(title="Cancel image projekt")
    db.add(project)
    await db.flush()
    char = Character(project_id=project.id, name="Hüpatia")
    db.add(char)
    await db.flush()
    placeholder = MediaAsset(
        status="generating",
        project_id=project.id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model_name="gemini/x",
    )
    db.add(placeholder)
    await db.flush()
    job = GenerationJob(
        project_id=project.id,
        job_type=JobType.IMAGE,
        status=status,
        input_data={
            "entity_type": "character",
            "entity_id": str(char.id),
            "style": "realistic_portrait",
            "model": "gemini/x",
            "asset_id": str(placeholder.id),
        },
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job, placeholder.id


def _images_cancelling_mid_generate(job_id: uuid.UUID, asset_id: uuid.UUID):
    """Mocked ImageService whose generate flips the job to CANCELLED mid-work
    and then finishes normally — the terminal transition must NOT stomp it."""
    images = AsyncMock(spec=ImageService)

    async def _gen(db, **kwargs):
        current = await db.get(GenerationJob, job_id)
        current.status = JobStatus.CANCELLED
        await db.commit()
        return MediaAsset(id=asset_id, status="ready")

    images.generate_for_entity.side_effect = _gen
    return images


@pytest.mark.integration
async def test_image_job_cancel_mid_generate_is_not_stomped_by_done(db_session):
    """Cancel lands WHILE the image generates → the job must end CANCELLED; the
    terminal transition must not overwrite it with DONE."""
    job, asset_id = await _make_image_job(db_session, JobStatus.PENDING)
    images = _images_cancelling_mid_generate(job.id, asset_id)

    await _run_image_job(
        job.id, session_factory=_session_factory(db_session), images=images
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.CANCELLED


@pytest.mark.integration
async def test_image_job_already_cancelled_never_starts_work(db_session):
    """A job cancelled BEFORE the worker dequeues it must be a no-op: no
    RUNNING flip, no image generation at all."""
    job, _asset_id = await _make_image_job(db_session, JobStatus.CANCELLED)
    images = AsyncMock(spec=ImageService)

    await _run_image_job(
        job.id, session_factory=_session_factory(db_session), images=images
    )

    images.generate_for_entity.assert_not_awaited()
    images.generate_cover_for_book.assert_not_awaited()
    await db_session.refresh(job)
    assert job.status == JobStatus.CANCELLED


@pytest.mark.integration
async def test_image_job_cancel_then_failure_stays_cancelled(db_session):
    """Cancel lands mid-work and THEN the generate raises → the failure handler
    must not overwrite CANCELLED with FAILED (the placeholder still flips to
    'failed' so the FE spinner stops)."""
    job, asset_id = await _make_image_job(db_session, JobStatus.PENDING)
    images = AsyncMock(spec=ImageService)

    async def _cancel_then_boom(db, **kwargs):
        current = await db.get(GenerationJob, job.id)
        current.status = JobStatus.CANCELLED
        await db.commit()
        raise RuntimeError("boom mid-generate")

    images.generate_for_entity.side_effect = _cancel_then_boom

    await _run_image_job(
        job.id, session_factory=_session_factory(db_session), images=images
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.CANCELLED
    assert job.error_message is None  # the failed-write was skipped entirely
    placeholder = await db_session.get(MediaAsset, asset_id)
    assert placeholder is not None
    assert placeholder.status == "failed"


@pytest.mark.integration
async def test_image_job_deleted_mid_generate_is_graceful(db_session):
    """DELETE /jobs/{id} lands while the image generates → the run must return
    cleanly (no exception from the terminal transition on a vanished row)."""
    job, asset_id = await _make_image_job(db_session, JobStatus.PENDING)
    job_id = job.id
    images = AsyncMock(spec=ImageService)

    async def _delete_row(db, **kwargs):
        current = await db.get(GenerationJob, job_id)
        await db.delete(current)
        await db.commit()
        return MediaAsset(id=asset_id, status="ready")

    images.generate_for_entity.side_effect = _delete_row

    # Must not raise.
    await _run_image_job(
        job_id, session_factory=_session_factory(db_session), images=images
    )

    assert await db_session.get(GenerationJob, job_id) is None  # stays deleted
