"""app.jobs.chapter_generation_job — the worker-side chapter-generate job (T3).

Driven directly (no Redis, no worker process) against the test DB via an injected
``session_factory`` + a mocked ``AIService`` so NO real LLM runs. Covers:
  - N selected scenes → N ``approved=False`` revisions all linked to the PARENT
    job;
  - ``output_data`` progress advances (completed/failed/scenes) and is committed
    progressively;
  - a per-scene failure is ISOLATED (failed++, the rest still complete, job DONE)
    — mutation-proven;
  - ``run_continuity=True`` populates ``warning_count`` from a mocked continuity
    result;
  - the missing-job / missing-chapter no-op + hard-failure paths;
  - the dotted-path producer/consumer contract.
"""

import importlib
import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import pytest
from alexandria_core.models.beat import Beat
from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.generation_job import (
    GenerationJob,
    JobStatus,
    JobType,
)
from alexandria_core.models.project import Project
from alexandria_core.models.revision import Revision
from alexandria_core.models.scene import Scene
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.jobs.chapter_generation_job import (
    _run_chapter_generation_job,
    run_chapter_generation_job,
)
from app.services.ai_service import AIService
from app.services.embedding_service import EmbeddingService
from app.services.model_router import ModelResponse, ModelRouter
from app.services.prompt_loader import prompt_loader
from app.services.revision_service import revision_service


def _real_ai_with_router(continuity_json: str) -> AIService:
    """A REAL AIService wired to a mocked ROUTER + a no-provider embedder.

    This exercises the genuine ``generate_scene_revision`` + ``analyze_continuity_text``
    code paths (real prompt assembly + real ``_parse_continuity``) — only the LLM
    call (``router.complete``) and the embedding layer are stubbed, so NO real LLM
    or vector DB runs. The router returns ``continuity_json`` for EVERY call; the
    generate path just stores it as the (throwaway) revision content, and the
    continuity path parses it into warnings via the real parser.
    """
    router = AsyncMock(spec=ModelRouter)
    router.build_messages.side_effect = lambda system, user: [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    router.complete.return_value = ModelResponse(
        content=continuity_json, model="ollama/llama3.2", usage={}
    )
    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = None  # RAG unconfigured → empty ctx
    return AIService(
        router=router, loader=prompt_loader, svc=revision_service, embeddings=emb
    )


def _session_factory(db_session: AsyncSession):
    """Inject the test's transactional ``db_session`` as the worker's session
    factory (same recipe as the index-job tests — the worker re-uses the test
    session; the yielded context must NOT close it)."""

    @asynccontextmanager
    async def _factory():
        yield db_session

    return _factory


async def _make_chapter(
    db: AsyncSession, *, scene_beat_counts: list[int]
) -> tuple[GenerationJob, list[uuid.UUID]]:
    """project→book→chapter→N scenes (scene i has scene_beat_counts[i] beats) plus
    a PENDING chapter-generate parent job over all of them. Returns (job, [scene_ids]).
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
    # Insert scenes out of order_index order to prove the job sorts by order_index.
    for i, beat_count in reversed(list(enumerate(scene_beat_counts))):
        scene = Scene(chapter_id=chapter.id, title=f"Jelenet {i}", order_index=i)
        db.add(scene)
        await db.flush()
        scene_ids.insert(0, scene.id)
        for j in range(beat_count):
            db.add(
                Beat(scene_id=scene.id, description=f"Beat {i}.{j}", order_index=j)
            )
    job = GenerationJob(
        chapter_id=chapter.id,
        project_id=project.id,
        job_type=JobType.CHAPTER_GENERATE,
        status=JobStatus.PENDING,
        input_data={
            "scene_ids": [str(s) for s in scene_ids],
            "run_continuity": False,
        },
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job, scene_ids


def _ai_service_making_revisions(db_session: AsyncSession):
    """A mocked AIService whose ``generate_scene_revision`` actually persists a
    real ``Revision(approved=False)`` linked to the passed job_id + scene_id (so
    the test can assert the real effect — revisions created + linked), and returns
    ``(revision, [])`` like the real core. NO LLM runs."""
    svc = AsyncMock()

    async def _gen(db, *, scene, beats, job_id, **kwargs):
        scene_id = getattr(scene, "id", scene)
        rev = Revision(
            content=f"Generated for {scene_id}",
            revision_type="generate_scene",
            approved=False,
            scene_id=scene_id,
            job_id=job_id,
            model_name="ollama/llama3.2",
            prompt_version="1.0",
        )
        db.add(rev)
        await db.flush()
        return rev, []

    svc.generate_scene_revision.side_effect = _gen
    return svc


@pytest.mark.integration
async def test_chapter_job_creates_one_revision_per_scene_linked_to_parent(
    db_session: AsyncSession,
):
    job, scene_ids = await _make_chapter(db_session, scene_beat_counts=[2, 1, 1])
    svc = _ai_service_making_revisions(db_session)

    await _run_chapter_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.DONE
    # Exactly N revisions, ALL linked to the PARENT job, all unapproved.
    revs = (
        await db_session.execute(
            select(Revision).where(Revision.job_id == job.id)
        )
    ).scalars().all()
    assert len(revs) == len(scene_ids)
    assert {r.scene_id for r in revs} == set(scene_ids)
    assert all(r.approved is False for r in revs)
    assert all(r.job_id == job.id for r in revs)

    # generate_scene_revision called once per scene, each with the PARENT job_id.
    assert svc.generate_scene_revision.await_count == len(scene_ids)
    for call in svc.generate_scene_revision.await_args_list:
        assert call.kwargs["job_id"] == job.id

    # output_data totals are exact.
    assert job.output_data["total"] == len(scene_ids)
    assert job.output_data["completed"] == len(scene_ids)
    assert job.output_data["failed"] == 0
    assert len(job.output_data["scenes"]) == len(scene_ids)
    assert all(e["status"] == "done" for e in job.output_data["scenes"])


@pytest.mark.integration
async def test_chapter_job_generates_scenes_in_order_index_order(
    db_session: AsyncSession,
):
    """The scenes entries follow order_index (story order), not selection/insert
    order — proves the resolver sorts by order_index."""
    job, scene_ids = await _make_chapter(db_session, scene_beat_counts=[1, 1, 1])
    svc = _ai_service_making_revisions(db_session)

    await _run_chapter_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )
    await db_session.refresh(job)
    ordered = [e["scene_id"] for e in job.output_data["scenes"]]
    assert ordered == [str(s) for s in scene_ids]


@pytest.mark.integration
async def test_chapter_job_passes_beats_in_order(db_session: AsyncSession):
    """Each scene's beats are passed as ordered descriptions."""
    job, scene_ids = await _make_chapter(db_session, scene_beat_counts=[3])
    svc = _ai_service_making_revisions(db_session)

    await _run_chapter_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )
    call = svc.generate_scene_revision.await_args_list[0]
    assert call.kwargs["beats"] == ["Beat 0.0", "Beat 0.1", "Beat 0.2"]


@pytest.mark.integration
async def test_chapter_job_progress_is_committed_progressively(
    db_session: AsyncSession,
):
    """After each scene, ``output_data`` is committed so the UI polls live
    progress — assert ``completed`` advances 0→1→2 as scenes are processed."""
    job, scene_ids = await _make_chapter(db_session, scene_beat_counts=[1, 1])
    svc = AsyncMock()
    seen_completed: list[int] = []

    async def _gen(db, *, scene, beats, job_id, **kwargs):
        # Read the persisted job's completed-so-far at the moment this scene runs.
        current = await db.get(GenerationJob, job_id)
        seen_completed.append((current.output_data or {}).get("completed", 0))
        scene_id = getattr(scene, "id", scene)
        rev = Revision(
            content="x",
            revision_type="generate_scene",
            approved=False,
            scene_id=scene_id,
            job_id=job_id,
        )
        db.add(rev)
        await db.flush()
        return rev, []

    svc.generate_scene_revision.side_effect = _gen
    await _run_chapter_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )
    # First scene sees 0 completed; second sees 1 (the first was committed).
    assert seen_completed == [0, 1]


@pytest.mark.integration
async def test_chapter_job_isolates_a_failing_scene(db_session: AsyncSession):
    """A scene whose generation RAISES is isolated: failed++, the remaining scenes
    still complete, and the job ends DONE. Mutation guard: if a per-scene failure
    aborts the loop, the 3rd scene never runs and this fails."""
    job, scene_ids = await _make_chapter(db_session, scene_beat_counts=[1, 1, 1])
    svc = AsyncMock()
    fail_scene = scene_ids[1]

    async def _gen(db, *, scene, beats, job_id, **kwargs):
        scene_id = getattr(scene, "id", scene)
        if scene_id == fail_scene:
            raise RuntimeError("scene boom\nsecret-tail " + "x" * 5000)
        rev = Revision(
            content="ok",
            revision_type="generate_scene",
            approved=False,
            scene_id=scene_id,
            job_id=job_id,
        )
        db.add(rev)
        await db.flush()
        return rev, []

    svc.generate_scene_revision.side_effect = _gen
    await _run_chapter_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    await db_session.refresh(job)
    # Partial failure → still DONE (only a couldn't-start failure is FAILED).
    assert job.status == JobStatus.DONE
    assert job.output_data["total"] == 3
    assert job.output_data["completed"] == 2
    assert job.output_data["failed"] == 1
    # All three scenes ran (the failing one did NOT abort the loop).
    assert svc.generate_scene_revision.await_count == 3
    # The two non-failing scenes each produced a real revision.
    revs = (
        await db_session.execute(
            select(Revision).where(Revision.job_id == job.id)
        )
    ).scalars().all()
    assert len(revs) == 2
    assert {r.scene_id for r in revs} == {scene_ids[0], scene_ids[2]}
    # The failed scene entry carries a SANITIZED, bounded error (no secret tail).
    failed_entry = next(
        e for e in job.output_data["scenes"] if e["scene_id"] == str(fail_scene)
    )
    assert failed_entry["status"] == "failed"
    assert "\n" not in failed_entry["error"]
    assert len(failed_entry["error"]) <= 300
    assert "x" * 400 not in failed_entry["error"]


@pytest.mark.integration
async def test_chapter_job_run_continuity_populates_warning_count(
    db_session: AsyncSession,
):
    """``run_continuity=True`` continuity-checks each GENERATED revision's text via
    the REAL ``analyze_continuity_text`` path (only the router is mocked) and
    records the parsed warning count in the scene entry.

    Mutation-proof: ``warning_count`` is the REAL ``len(warnings)`` of what the
    router returned (a 2-element JSON array), parsed by the genuine
    ``_parse_continuity`` — NOT a hardcoded number. Replacing
    ``warning_count = len(warnings)`` with a hardcoded value (e.g. 999) fails
    these exact-2 asserts; a broken parse that drops warnings would too.

    It also pins the architectural fix: the chapter job must NOT spawn a child
    ``continuity`` GenerationJob per scene (those would be orphans not linked to
    the parent) — analyze_continuity_text creates none, so the ONLY jobs in the DB
    are the parent.
    """
    job, scene_ids = await _make_chapter(db_session, scene_beat_counts=[1, 1])
    job.input_data = {"scene_ids": [str(s) for s in scene_ids], "run_continuity": True}
    await db_session.commit()

    # The router returns a continuity array with exactly 2 valid warnings.
    continuity_json = (
        '[{"severity":"warning","message":"Eltérés A","entity":"Anna"},'
        '{"severity":"info","message":"Megjegyzés B"}]'
    )
    svc = _real_ai_with_router(continuity_json)

    await _run_chapter_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.DONE
    # Each generated scene's entry carries the REAL parsed warning count (2).
    assert len(job.output_data["scenes"]) == 2
    assert all(e["warning_count"] == 2 for e in job.output_data["scenes"])
    assert all(len(e["warnings"]) == 2 for e in job.output_data["scenes"])

    # No orphan child continuity jobs: the ONLY GenerationJob is the parent.
    all_jobs = (
        await db_session.execute(select(GenerationJob))
    ).scalars().all()
    assert [j.id for j in all_jobs] == [job.id]
    # The generated revisions are still linked to the PARENT job (HITL intact).
    revs = (
        await db_session.execute(select(Revision).where(Revision.job_id == job.id))
    ).scalars().all()
    assert len(revs) == 2


@pytest.mark.integration
async def test_chapter_job_continuity_failure_keeps_revision_and_progresses(
    db_session: AsyncSession,
):
    """A continuity LLM failure must NOT lose the scene's generated revision nor
    abort the job: the scene stays ``completed`` with ``warning_count=0`` (+ a
    recorded error), the revision remains committed, and the job ends DONE.

    Guards item #2 (double-rollback fragility): the continuity failure handler
    must not revert the already-committed revision or prior job progress.
    """
    job, scene_ids = await _make_chapter(db_session, scene_beat_counts=[1, 1])
    job.input_data = {"scene_ids": [str(s) for s in scene_ids], "run_continuity": True}
    await db_session.commit()

    # Real generate path (router returns plain text), but continuity raises: build
    # an AIService whose router.complete succeeds for generation but the continuity
    # parse path blows up. Simplest: make analyze_continuity_text raise by having
    # the router raise on the SECOND call per scene (continuity), succeed on first.
    router = AsyncMock(spec=ModelRouter)
    router.build_messages.side_effect = lambda system, user: [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    calls = {"n": 0}

    async def _complete(**kwargs):
        calls["n"] += 1
        # Odd calls = generation (succeed); even calls = continuity (fail).
        if calls["n"] % 2 == 0:
            raise RuntimeError("continuity LLM down")
        return ModelResponse(content="Generált jelenet.", model="m", usage={})

    router.complete.side_effect = _complete
    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = None
    svc = AIService(
        router=router, loader=prompt_loader, svc=revision_service, embeddings=emb
    )

    await _run_chapter_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.DONE
    # Both scenes completed (generation succeeded); continuity failed → wc 0.
    assert job.output_data["completed"] == 2
    assert job.output_data["failed"] == 0
    assert all(e["warning_count"] == 0 for e in job.output_data["scenes"])
    assert all("continuity_error" in e for e in job.output_data["scenes"])
    # The generated revisions survived the continuity failure (not rolled back).
    revs = (
        await db_session.execute(select(Revision).where(Revision.job_id == job.id))
    ).scalars().all()
    assert len(revs) == 2


@pytest.mark.integration
async def test_chapter_job_no_continuity_leaves_warning_count_zero(
    db_session: AsyncSession,
):
    """Default (run_continuity off) → no continuity call, warning_count stays 0."""
    job, scene_ids = await _make_chapter(db_session, scene_beat_counts=[1])
    svc = _ai_service_making_revisions(db_session)

    await _run_chapter_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )
    await db_session.refresh(job)
    svc.check_continuity.assert_not_awaited()
    assert job.output_data["scenes"][0]["warning_count"] == 0


@pytest.mark.integration
async def test_chapter_job_missing_job_is_noop(db_session: AsyncSession):
    """An unknown job id is a clean no-op (deleted before the worker ran)."""
    svc = AsyncMock()
    await _run_chapter_generation_job(
        uuid.uuid4(), session_factory=_session_factory(db_session), ai=svc
    )
    svc.generate_scene_revision.assert_not_awaited()


@pytest.mark.integration
async def test_chapter_job_missing_chapter_marks_failed(db_session: AsyncSession):
    """A job whose chapter is gone can't start → FAILED with a sanitized message,
    no scene work attempted."""
    job, scene_ids = await _make_chapter(db_session, scene_beat_counts=[1])
    job.chapter_id = uuid.uuid4()  # point at a nonexistent chapter
    await db_session.commit()

    svc = AsyncMock()
    await _run_chapter_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )
    await db_session.refresh(job)
    assert job.status == JobStatus.FAILED
    assert job.error_message
    svc.generate_scene_revision.assert_not_awaited()


@pytest.mark.unit
def test_run_chapter_generation_job_dotted_path_resolves():
    """The dotted path the producer enqueues must resolve to the sync entrypoint
    the worker runs — pins producer/consumer agreement (rename = test fails)."""
    from app.services.job_queue import CHAPTER_GENERATION_JOB_PATH

    module_path, _, attr = CHAPTER_GENERATION_JOB_PATH.rpartition(".")
    mod = importlib.import_module(module_path)
    assert getattr(mod, attr) is run_chapter_generation_job
