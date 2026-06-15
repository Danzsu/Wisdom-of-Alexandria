"""Integration tests for GenerationJob read endpoints."""
import uuid

import pytest
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

    # The AI service has no domain (projects/scenes) endpoints — those live in
    # apps/api. ``list_jobs`` filters jobs by the ``scene_id`` column with no FK
    # join, so a synthetic UUID exercises the filter exactly the same way.
    scene_id = uuid.uuid4()

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
