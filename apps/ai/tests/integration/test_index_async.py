"""POST /ai/index/async — enqueue an async RAG index job (P1L-1).

These cover the ENQUEUE side: the endpoint must persist a PENDING, project-scoped
index job and hand its id to the queue (mocked — no Redis), validate project_id,
require auth, and never leave a job stuck PENDING when enqueueing fails.
"""

import uuid
from unittest.mock import patch

import pytest
from alexandria_core.models.generation_job import GenerationJob, JobStatus, JobType
from alexandria_core.models.project import Project
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def _make_project(db: AsyncSession) -> uuid.UUID:
    project = Project(title="Index projekt")
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project.id


@pytest.mark.integration
async def test_index_async_creates_pending_job_and_enqueues(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    project_id = await _make_project(db_session)
    with patch("app.api.v1.ai.enqueue_index_job") as mock_enqueue:
        resp = await client.post(
            f"/api/v1/ai/index/async?project_id={project_id}", headers=auth_headers
        )
    assert resp.status_code == 202
    data = resp.json()
    assert data["job_type"] == JobType.INDEX
    assert data["status"] == JobStatus.PENDING
    assert data["project_id"] == str(project_id)

    # Enqueued exactly once, with the created job's id (so the worker loads THIS row).
    mock_enqueue.assert_called_once()
    (enqueued_id,) = mock_enqueue.call_args.args
    assert str(enqueued_id) == data["id"]

    # Actually persisted as a pending index job for the project.
    job = (
        await db_session.execute(
            select(GenerationJob).where(GenerationJob.id == uuid.UUID(data["id"]))
        )
    ).scalar_one()
    assert job.project_id == project_id
    assert job.job_type == JobType.INDEX
    assert job.status == JobStatus.PENDING


@pytest.mark.integration
async def test_index_async_accepts_project_id_in_body(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    project_id = await _make_project(db_session)
    with patch("app.api.v1.ai.enqueue_index_job") as mock_enqueue:
        resp = await client.post(
            "/api/v1/ai/index/async",
            json={"project_id": str(project_id)},
            headers=auth_headers,
        )
    assert resp.status_code == 202
    assert resp.json()["project_id"] == str(project_id)
    mock_enqueue.assert_called_once()


@pytest.mark.integration
async def test_index_async_requires_project_id(
    client: AsyncClient, auth_headers: dict
):
    resp = await client.post("/api/v1/ai/index/async", headers=auth_headers)
    assert resp.status_code == 422


@pytest.mark.integration
async def test_index_async_requires_auth(client: AsyncClient):
    resp = await client.post(f"/api/v1/ai/index/async?project_id={uuid.uuid4()}")
    assert resp.status_code == 401


@pytest.mark.integration
async def test_index_async_enqueue_failure_marks_job_failed(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession
):
    """If enqueue raises (e.g. Redis unreachable), the job must be persisted as
    FAILED (never stuck PENDING) and the endpoint returns a sanitized 502."""
    project_id = await _make_project(db_session)
    with patch(
        "app.api.v1.ai.enqueue_index_job",
        side_effect=RuntimeError("redis down secret-leak-xyz"),
    ):
        resp = await client.post(
            f"/api/v1/ai/index/async?project_id={project_id}", headers=auth_headers
        )
    assert resp.status_code == 502
    # The job exists and is FAILED, not left dangling as PENDING.
    job = (
        await db_session.execute(
            select(GenerationJob).where(GenerationJob.project_id == project_id)
        )
    ).scalar_one()
    assert job.status == JobStatus.FAILED
