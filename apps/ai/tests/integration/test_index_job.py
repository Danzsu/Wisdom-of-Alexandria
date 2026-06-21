"""app.jobs.index_job — the worker-side async RAG index job (P1L-1).

Driven directly (no Redis, no worker process) against the test DB via an injected
``session_factory`` + a mocked ``EmbeddingService``. Covers the
pending -> running -> done/failed state machine, the persisted counts, the
no-provider no-op success, and the sanitized failure path (mutation-proven), plus
the dotted-path producer/consumer contract.
"""

import importlib
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from alexandria_core.models.generation_job import GenerationJob, JobStatus, JobType
from alexandria_core.models.project import Project
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.jobs.index_job import _run_index_job, run_index_job
from app.services.embedding_service import EmbeddingService


def _factory(engine_fixture):
    """A fresh session factory bound to the test engine — mirrors the worker
    opening its OWN session (separate from the request/test session)."""
    return async_sessionmaker(
        engine_fixture, expire_on_commit=False, class_=AsyncSession
    )


def _sync_result(indexed=0, updated=0, deleted=0, skipped=0, capped=False):
    return SimpleNamespace(
        indexed=indexed, updated=updated, deleted=deleted, skipped=skipped, capped=capped
    )


async def _make_project(db: AsyncSession) -> uuid.UUID:
    p = Project(title="Index job projekt")
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p.id


async def _make_index_job(db: AsyncSession, project_id: uuid.UUID) -> GenerationJob:
    job = GenerationJob(
        project_id=project_id, job_type=JobType.INDEX, status=JobStatus.PENDING
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


@pytest.mark.integration
async def test_index_job_runs_sync_and_records_counts(db_session, engine_fixture):
    project_id = await _make_project(db_session)
    job = await _make_index_job(db_session, project_id)

    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = "openai/text-embedding-3-small"
    emb.sync_project.return_value = _sync_result(indexed=3, updated=1, skipped=2)

    await _run_index_job(
        job.id, session_factory=_factory(engine_fixture), embeddings=emb
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.DONE
    assert job.output_data["indexed"] == 3
    assert job.output_data["updated"] == 1
    assert job.output_data["skipped"] == 2
    assert job.output_data["skipped_no_provider"] is False
    # sync_project was called against the job's own project.
    emb.sync_project.assert_awaited_once()
    assert emb.sync_project.await_args.args[1] == project_id


@pytest.mark.integration
async def test_index_job_is_running_when_sync_executes(db_session, engine_fixture):
    """Mutation guard for the pending->RUNNING commit: at the moment sync_project
    runs, the job row must already be RUNNING (committed before the heavy work),
    so a separate reader (the worker's own session) observes progress."""
    project_id = await _make_project(db_session)
    job = await _make_index_job(db_session, project_id)
    captured = {}

    async def _capturing_sync(db, project_id_arg, *, embedding_model):
        current = await db.get(GenerationJob, job.id)
        captured["status_at_sync"] = current.status
        return _sync_result(indexed=1)

    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = "openai/text-embedding-3-small"
    emb.sync_project.side_effect = _capturing_sync

    await _run_index_job(
        job.id, session_factory=_factory(engine_fixture), embeddings=emb
    )
    assert captured["status_at_sync"] == JobStatus.RUNNING


@pytest.mark.integration
async def test_index_job_no_provider_is_noop_success(db_session, engine_fixture):
    project_id = await _make_project(db_session)
    job = await _make_index_job(db_session, project_id)

    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = None  # RAG unconfigured

    await _run_index_job(
        job.id, session_factory=_factory(engine_fixture), embeddings=emb
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.DONE
    assert job.output_data["skipped_no_provider"] is True
    assert job.output_data["indexed"] == 0
    emb.sync_project.assert_not_awaited()  # no embedding work attempted


@pytest.mark.integration
async def test_index_job_failure_is_persisted_and_sanitized(db_session, engine_fixture):
    """A sync_project crash -> job FAILED with a bounded, single-line
    error_message. Mutation guard: drop the except-branch and the job stays
    RUNNING, failing these asserts. (safe_error bounds/one-lines; it does not
    strip secrets by design — we assert boundedness, matching fail_job.)"""
    project_id = await _make_project(db_session)
    job = await _make_index_job(db_session, project_id)

    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = "openai/text-embedding-3-small"
    raw = "boom internal\nline2\n" + ("x" * 5000)
    emb.sync_project.side_effect = RuntimeError(raw)

    await _run_index_job(
        job.id, session_factory=_factory(engine_fixture), embeddings=emb
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.FAILED
    assert job.error_message
    assert "\n" not in job.error_message  # collapsed to one line
    assert len(job.error_message) <= 300  # bounded
    assert "x" * 400 not in job.error_message  # 5000-char tail truncated away


@pytest.mark.integration
async def test_index_job_missing_job_is_noop(db_session, engine_fixture):
    """An unknown job id is a clean no-op (e.g. the job was deleted before the
    worker picked it up) — never a crash."""
    emb = AsyncMock(spec=EmbeddingService)
    await _run_index_job(
        uuid.uuid4(), session_factory=_factory(engine_fixture), embeddings=emb
    )
    emb.resolve_embedding_model.assert_not_awaited()


@pytest.mark.unit
def test_run_index_job_dotted_path_resolves():
    """The dotted path the producer enqueues must resolve to the sync entrypoint
    the worker runs — pins producer/consumer agreement (rename = test fails)."""
    from app.services.job_queue import INDEX_JOB_PATH

    module_path, _, attr = INDEX_JOB_PATH.rpartition(".")
    mod = importlib.import_module(module_path)
    assert getattr(mod, attr) is run_index_job
