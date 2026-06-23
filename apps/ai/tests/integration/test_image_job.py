"""app.jobs.image_job — the worker-side async Codex image generation job.

Driven directly (no Redis, no worker process) against the test DB via an injected
``session_factory`` + a mocked ``ImageService``. Covers the
pending -> running -> done/failed state machine, the persisted media_asset_id, the
missing-required-input failure, and the sanitized failure path (mutation-proven),
plus the dotted-path producer/consumer contract.
"""

import importlib
import uuid
from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from alexandria_core.models.book import Book
from alexandria_core.models.character import Character
from alexandria_core.models.generation_job import GenerationJob, JobStatus, JobType
from alexandria_core.models.media_asset import MediaAsset
from alexandria_core.models.project import Project
from sqlalchemy.ext.asyncio import AsyncSession

from app.jobs.image_job import _run_image_job, run_image_job
from app.services.image_service import ImageService


def _session_factory(db_session: AsyncSession):
    """Inject the test's transactional ``db_session`` as the worker's session
    factory.

    In production the worker opens its OWN session (``AsyncSessionLocal``); the
    ``session_factory`` injection point exists precisely so a test can substitute
    one. Under the per-test isolation fixture the test's writes live in an
    uncommitted outer transaction, so a genuinely separate connection could not
    see them — and that separate connection is infrastructure, not the behaviour
    under test (the state machine + media_asset_id + sanitized failure ARE). So the
    worker re-uses the test session; the yielded context must NOT close it (the
    fixture owns its lifecycle)."""

    @asynccontextmanager
    async def _factory():
        yield db_session

    return _factory


async def _make_project(db: AsyncSession) -> uuid.UUID:
    p = Project(title="Image job projekt")
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p.id


async def _make_character(db: AsyncSession, project_id: uuid.UUID) -> Character:
    c = Character(project_id=project_id, name="Aristarkhosz")
    db.add(c)
    await db.commit()
    await db.refresh(c)
    return c


async def _make_book(
    db: AsyncSession,
    project_id: uuid.UUID,
    title: str = "A Fárosz árnyéka",
    author: str = "Rácz Dániel",
) -> uuid.UUID:
    b = Book(project_id=project_id, title=title, author=author)
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return b.id


# Alias for clarity in cover-branch tests (same shim as _session_factory).
_single_session_factory = _session_factory


async def _make_image_job(
    db: AsyncSession, project_id: uuid.UUID, input_data: dict
) -> GenerationJob:
    job = GenerationJob(
        project_id=project_id,
        job_type=JobType.IMAGE,
        status=JobStatus.PENDING,
        input_data=input_data,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


def _input(char_id: uuid.UUID, asset_id: uuid.UUID | None = None, **overrides) -> dict:
    data = {
        "entity_type": "character",
        "entity_id": str(char_id),
        "style": "realistic_portrait",
        "model": "gemini/gemini-3.1-flash-image",
        "asset_id": str(asset_id) if asset_id is not None else str(uuid.uuid4()),
    }
    data.update(overrides)
    return data


async def _make_placeholder(
    db: AsyncSession,
    project_id: uuid.UUID,
    entity_type: str,
    entity_id: uuid.UUID,
    style: str = "realistic_portrait",
) -> MediaAsset:
    """Create a 'generating' placeholder as the endpoint does before enqueueing."""
    ph = MediaAsset(
        status="generating",
        project_id=project_id,
        entity_type=entity_type,
        entity_id=entity_id,
        style=style,
        model_name="gemini/x",
    )
    db.add(ph)
    await db.commit()
    await db.refresh(ph)
    return ph


@pytest.mark.integration
async def test_image_job_runs_and_records_media_asset(db_session):
    project_id = await _make_project(db_session)
    char = await _make_character(db_session, project_id)
    placeholder = await _make_placeholder(db_session, project_id, "character", char.id)
    job = await _make_image_job(db_session, project_id, _input(char.id, placeholder.id))

    images = AsyncMock(spec=ImageService)
    images.generate_for_entity.return_value = MediaAsset(
        id=placeholder.id,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        status="ready",
    )

    await _run_image_job(
        job.id, session_factory=_session_factory(db_session), images=images
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.DONE
    assert job.output_data["media_asset_id"] == str(placeholder.id)

    images.generate_for_entity.assert_awaited_once()
    kwargs = images.generate_for_entity.await_args.kwargs
    assert kwargs["project_id"] == project_id
    assert kwargs["entity_type"] == "character"
    assert kwargs["entity_id"] == char.id
    assert kwargs["style"] == "realistic_portrait"
    assert kwargs["model"] == "gemini/gemini-3.1-flash-image"
    assert kwargs["job_id"] == job.id
    assert kwargs["asset_id"] == placeholder.id


@pytest.mark.integration
async def test_image_job_is_running_when_generate_executes(db_session):
    """Mutation guard for the pending->RUNNING commit ORDER: at the moment
    generate_for_entity runs, the job row must already be RUNNING (committed
    before the heavy work)."""
    project_id = await _make_project(db_session)
    char = await _make_character(db_session, project_id)
    placeholder = await _make_placeholder(db_session, project_id, "character", char.id)
    job = await _make_image_job(db_session, project_id, _input(char.id, placeholder.id))
    captured = {}

    async def _capturing_generate(db, **kwargs):
        current = await db.get(GenerationJob, job.id)
        captured["status_at_generate"] = current.status
        return MediaAsset(
            id=placeholder.id,
            project_id=project_id,
            entity_type="character",
            entity_id=char.id,
            status="ready",
        )

    images = AsyncMock(spec=ImageService)
    images.generate_for_entity.side_effect = _capturing_generate

    await _run_image_job(
        job.id, session_factory=_session_factory(db_session), images=images
    )
    assert captured["status_at_generate"] == JobStatus.RUNNING


@pytest.mark.integration
async def test_image_job_failure_is_persisted_and_sanitized(db_session):
    """A generate crash -> job FAILED with a bounded, single-line error_message,
    and the exception is NOT re-raised (the call returns normally)."""
    project_id = await _make_project(db_session)
    char = await _make_character(db_session, project_id)
    placeholder = await _make_placeholder(db_session, project_id, "character", char.id)
    job = await _make_image_job(db_session, project_id, _input(char.id, placeholder.id))

    images = AsyncMock(spec=ImageService)
    raw = "boom\nSECRET\n" + ("x" * 5000)
    images.generate_for_entity.side_effect = RuntimeError(raw)

    # Returns normally (no re-raise).
    await _run_image_job(
        job.id, session_factory=_session_factory(db_session), images=images
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.FAILED
    assert job.error_message
    assert "\n" not in job.error_message  # collapsed to one line
    assert len(job.error_message) <= 300  # bounded
    assert "x" * 400 not in job.error_message  # 5000-char tail truncated away


@pytest.mark.integration
async def test_image_job_missing_required_input_fails(db_session):
    """An input_data missing a required field (here ``style``) -> job FAILED with
    a clear message, and generate_for_entity is never attempted."""
    project_id = await _make_project(db_session)
    char = await _make_character(db_session, project_id)
    placeholder = await _make_placeholder(db_session, project_id, "character", char.id)
    bad = _input(char.id, placeholder.id)
    del bad["style"]
    job = await _make_image_job(db_session, project_id, bad)

    images = AsyncMock(spec=ImageService)

    await _run_image_job(
        job.id, session_factory=_session_factory(db_session), images=images
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.FAILED
    assert job.error_message
    images.generate_for_entity.assert_not_awaited()


@pytest.mark.integration
async def test_image_job_missing_job_is_noop(db_session):
    """An unknown job id is a clean no-op (e.g. deleted before the worker picked
    it up) — never a crash."""
    images = AsyncMock(spec=ImageService)
    await _run_image_job(
        uuid.uuid4(), session_factory=_session_factory(db_session), images=images
    )
    images.generate_for_entity.assert_not_awaited()


@pytest.mark.unit
def test_image_job_dotted_path_resolves():
    """The dotted path the producer enqueues must resolve to the sync entrypoint
    the worker runs — pins producer/consumer agreement (rename = test fails)."""
    from app.services.job_queue import IMAGE_JOB_PATH

    module_path, _, attr = IMAGE_JOB_PATH.rpartition(".")
    mod = importlib.import_module(module_path)
    assert getattr(mod, attr) is run_image_job


# ── cover branch ─────────────────────────────────────────────────────────────


@pytest.mark.integration
async def test_image_job_cover_branch(db_session, monkeypatch):
    project_id = await _make_project(db_session)
    book_id = await _make_book(db_session, project_id)

    # Create placeholder asset (as the endpoint does).
    placeholder = MediaAsset(
        status="generating",
        project_id=project_id,
        entity_type="cover",
        entity_id=book_id,
        style="cover_fantasy",
        model_name="gemini/x",
    )
    db_session.add(placeholder)
    await db_session.commit()
    await db_session.refresh(placeholder)

    job = GenerationJob(
        job_type=JobType.IMAGE,
        project_id=project_id,
        status=JobStatus.PENDING,
        model_name="gemini/x",
        input_data={
            "entity_type": "cover",
            "entity_id": str(book_id),
            "art_style": "cover_fantasy",
            "layout": "classic_centered",
            "title": "Fárosz",
            "author": "Rácz D.",
            "subtitle": None,
            "model": "gemini/x",
            "asset_id": str(placeholder.id),
        },
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)

    calls = {}

    async def fake_cover(db, **kw):
        calls.update(kw)
        return SimpleNamespace(id=placeholder.id)

    images = ImageService()
    monkeypatch.setattr(images, "generate_cover_for_book", fake_cover)

    await _run_image_job(
        job.id,
        session_factory=_single_session_factory(db_session),
        images=images,
    )
    refreshed = await db_session.get(GenerationJob, job.id)
    assert refreshed.status == JobStatus.DONE
    assert calls["art_style"] == "cover_fantasy" and calls["layout"] == "classic_centered"
    # asset_id is now forwarded to the service call.
    assert calls["asset_id"] == placeholder.id


# ── ADVERSARIAL: placeholder is updated on success (no second row) ───────────


@pytest.mark.integration
async def test_image_job_codex_passes_asset_id_to_service(db_session):
    """The job must pass the placeholder's asset_id to the service so it can
    UPDATE that row rather than creating a new one.

    Before the fix: asset_id was absent from input_data and not forwarded,
    so the service created a second row.
    """
    project_id = await _make_project(db_session)
    char = await _make_character(db_session, project_id)

    # Pre-create the placeholder as the endpoint does.
    placeholder = MediaAsset(
        status="generating",
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model_name="gemini/gemini-3.1-flash-image",
    )
    db_session.add(placeholder)
    await db_session.commit()
    await db_session.refresh(placeholder)

    job = await _make_image_job(
        db_session,
        project_id,
        {
            **_input(char.id),
            "asset_id": str(placeholder.id),
        },
    )

    captured: dict = {}
    ready_asset = MediaAsset(
        id=placeholder.id,
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        status="ready",
    )

    async def _capturing_generate(db, **kwargs):
        captured.update(kwargs)
        # Confirm the job is RUNNING at the moment the service is called.
        current_job = await db.get(GenerationJob, job.id)
        assert current_job.status == JobStatus.RUNNING
        return ready_asset

    images = AsyncMock(spec=ImageService)
    images.generate_for_entity.side_effect = _capturing_generate

    await _run_image_job(
        job.id, session_factory=_session_factory(db_session), images=images
    )

    # The job must forward the placeholder id to the service.
    assert "asset_id" in captured, "asset_id was not forwarded to generate_for_entity"
    assert captured["asset_id"] == placeholder.id

    await db_session.refresh(job)
    assert job.status == JobStatus.DONE
    assert job.output_data["media_asset_id"] == str(placeholder.id)


@pytest.mark.integration
async def test_image_job_failure_flips_placeholder_to_failed(db_session):
    """When the service raises, the job handler must flip the PLACEHOLDER's
    status to 'failed' so the FE spinner stops.

    Before the fix: the placeholder stayed 'generating' forever on failure.
    """
    project_id = await _make_project(db_session)
    char = await _make_character(db_session, project_id)

    placeholder = MediaAsset(
        status="generating",
        project_id=project_id,
        entity_type="character",
        entity_id=char.id,
        style="realistic_portrait",
        model_name="gemini/x",
    )
    db_session.add(placeholder)
    await db_session.commit()
    await db_session.refresh(placeholder)
    placeholder_id = placeholder.id

    job = await _make_image_job(
        db_session,
        project_id,
        {
            **_input(char.id),
            "asset_id": str(placeholder_id),
        },
    )

    images = AsyncMock(spec=ImageService)
    images.generate_for_entity.side_effect = RuntimeError("provider boom")

    await _run_image_job(
        job.id, session_factory=_session_factory(db_session), images=images
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.FAILED

    # The PLACEHOLDER must now be 'failed', not stuck 'generating'.
    reloaded = await db_session.get(MediaAsset, placeholder_id)
    assert reloaded is not None
    assert reloaded.status == "failed", (
        f"Placeholder must be 'failed' after job failure, got '{reloaded.status}'"
    )


@pytest.mark.integration
async def test_image_job_cover_failure_flips_placeholder_to_failed(db_session):
    """Same placeholder-flip guarantee for the cover branch on failure."""
    project_id = await _make_project(db_session)
    book_id = await _make_book(db_session, project_id)

    placeholder = MediaAsset(
        status="generating",
        project_id=project_id,
        entity_type="cover",
        entity_id=book_id,
        style="cover_fantasy",
        model_name="gemini/x",
    )
    db_session.add(placeholder)
    await db_session.commit()
    await db_session.refresh(placeholder)
    placeholder_id = placeholder.id

    job = GenerationJob(
        job_type=JobType.IMAGE,
        project_id=project_id,
        status=JobStatus.PENDING,
        model_name="gemini/x",
        input_data={
            "entity_type": "cover",
            "entity_id": str(book_id),
            "art_style": "cover_fantasy",
            "layout": "classic_centered",
            "title": "Fárosz",
            "author": "Rácz D.",
            "subtitle": None,
            "model": "gemini/x",
            "asset_id": str(placeholder_id),
        },
    )
    db_session.add(job)
    await db_session.commit()
    await db_session.refresh(job)

    images = AsyncMock(spec=ImageService)
    images.generate_cover_for_book.side_effect = RuntimeError("compositor boom")

    await _run_image_job(
        job.id, session_factory=_session_factory(db_session), images=images
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.FAILED

    reloaded = await db_session.get(MediaAsset, placeholder_id)
    assert reloaded is not None
    assert reloaded.status == "failed", (
        f"Cover placeholder must be 'failed' after job failure, got '{reloaded.status}'"
    )
