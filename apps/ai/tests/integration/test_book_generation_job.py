"""app.jobs.book_generation_job — the worker-side BOOK-generate job (V2 slice 2).

Driven directly (no Redis, no worker process) against the test DB via an
injected ``session_factory`` + a mocked ``AIService`` so NO real LLM runs. The
book job is a SEQUENTIAL wrapper over the same per-scene loop the chapter job
uses (the shared ``_generate_scenes_for_chapter`` helper). Covers:
  - chapters processed in story (order_index) order; per chapter only the EMPTY
    (no content) scenes WITH >=1 beat are generated — every produced
    ``Revision(approved=False)`` links to the PARENT book job;
  - a chapter with no generatable scenes → a ``skipped`` entry, loop continues;
  - a failing scene is ISOLATED (its chapter and the book both continue; DONE
    with partials);
  - book-level ``output_data`` progress is committed progressively;
  - cooperative cancel: entry guard, between chapters (prior chapters'
    revisions kept, CANCELLED preserved), and final-write protection;
  - ``run_continuity`` + model params thread through to the per-scene calls;
  - the missing-job / missing-book paths and the dotted-path + RQ-linkage
    producer/consumer contracts.
"""

import importlib
import uuid
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, patch

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

from app.jobs.book_generation_job import (
    _run_book_generation_job,
    run_book_generation_job,
)

# Scene spec: (beat_count, content). content=None → EMPTY scene (generatable
# when beat_count >= 1).
SceneSpec = tuple[int, str | None]


def _session_factory(db_session: AsyncSession):
    """Inject the test's transactional ``db_session`` as the worker's session
    factory (same recipe as the chapter/index-job tests)."""

    @asynccontextmanager
    async def _factory():
        yield db_session

    return _factory


async def _make_book_job(
    db: AsyncSession,
    *,
    chapters: list[list[SceneSpec]],
    run_continuity: bool = False,
    extra_input: dict | None = None,
) -> tuple[GenerationJob, list[uuid.UUID], dict[uuid.UUID, list[uuid.UUID]]]:
    """project→book→N chapters (+ scenes per spec) plus a PENDING book-generate
    parent job over ALL the chapters.

    Chapters and scenes are INSERTED in reverse order (ascending order_index) so
    a correct worker must sort by order_index. Returns
    ``(job, [chapter_ids in story order], {chapter_id: [scene_ids in order]})``.
    """
    project = Project(title="Könyv-gen projekt")
    db.add(project)
    await db.flush()
    book = Book(project_id=project.id, title="Könyv")
    db.add(book)
    await db.flush()
    chapter_ids: list[uuid.UUID] = [uuid.uuid4()] * len(chapters)
    scenes_by_chapter: dict[uuid.UUID, list[uuid.UUID]] = {}
    for i, scene_specs in reversed(list(enumerate(chapters))):
        chapter = Chapter(book_id=book.id, title=f"Fejezet {i}", order_index=i)
        db.add(chapter)
        await db.flush()
        chapter_ids[i] = chapter.id
        scene_ids: list[uuid.UUID] = [uuid.uuid4()] * len(scene_specs)
        for j, (beat_count, content) in reversed(list(enumerate(scene_specs))):
            scene = Scene(
                chapter_id=chapter.id,
                title=f"Jelenet {i}.{j}",
                order_index=j,
                content=content,
            )
            db.add(scene)
            await db.flush()
            scene_ids[j] = scene.id
            for k in range(beat_count):
                db.add(
                    Beat(
                        scene_id=scene.id,
                        description=f"Beat {i}.{j}.{k}",
                        order_index=k,
                    )
                )
        scenes_by_chapter[chapter.id] = scene_ids
    input_data: dict = {
        "book_id": str(book.id),
        "chapter_ids": [str(c) for c in chapter_ids],
        "run_continuity": run_continuity,
    }
    input_data.update(extra_input or {})
    job = GenerationJob(
        project_id=project.id,
        job_type=JobType.BOOK_GENERATE,
        status=JobStatus.PENDING,
        input_data=input_data,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job, chapter_ids, scenes_by_chapter


def _ai_service_making_revisions():
    """A mocked AIService whose ``generate_scene_revision`` persists a REAL
    ``Revision(approved=False)`` linked to the passed job_id + scene_id (so the
    tests assert the real effect), returning ``(revision, [])`` like the real
    core. NO LLM runs."""
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
async def test_book_job_generates_all_chapters_revisions_linked_to_parent(
    db_session: AsyncSession,
):
    """2 chapters × (2 + 1) generatable scenes → 3 revisions, ALL linked to the
    PARENT book job, chapters processed in story order, exact counts."""
    job, chapter_ids, scenes_by_chapter = await _make_book_job(
        db_session, chapters=[[(1, None), (1, None)], [(1, None)]]
    )
    svc = _ai_service_making_revisions()

    await _run_book_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.DONE
    all_scene_ids = [s for c in chapter_ids for s in scenes_by_chapter[c]]
    revs = (
        (
            await db_session.execute(
                select(Revision).where(Revision.job_id == job.id)
            )
        )
        .scalars()
        .all()
    )
    assert len(revs) == 3
    assert {r.scene_id for r in revs} == set(all_scene_ids)
    assert all(r.approved is False for r in revs)

    # Every per-scene call carried the PARENT book job's id.
    assert svc.generate_scene_revision.await_count == 3
    for call in svc.generate_scene_revision.await_args_list:
        assert call.kwargs["job_id"] == job.id

    # Book-level output_data totals are exact.
    out = job.output_data
    assert out["total_chapters"] == 2
    assert out["completed_chapters"] == 2
    assert out["total_scenes"] == 3
    assert out["completed"] == 3
    assert out["failed"] == 0
    assert out["skipped"] == []
    # chapters array follows story order with per-scene entries per chapter.
    assert [c["chapter_id"] for c in out["chapters"]] == [
        str(c) for c in chapter_ids
    ]
    assert [len(c["scenes"]) for c in out["chapters"]] == [2, 1]
    assert all(
        e["status"] == "done" for c in out["chapters"] for e in c["scenes"]
    )
    # Scenes inside a chapter follow order_index (story) order.
    assert [e["scene_id"] for e in out["chapters"][0]["scenes"]] == [
        str(s) for s in scenes_by_chapter[chapter_ids[0]]
    ]


@pytest.mark.integration
async def test_book_job_only_empty_scenes_with_beats_are_generated(
    db_session: AsyncSession,
):
    """The auto-selection is the SAFE default: a written scene (content) and a
    beat-less empty scene are never generated — only the empty+beats scene is."""
    job, chapter_ids, scenes_by_chapter = await _make_book_job(
        db_session,
        chapters=[[(2, "Már megírt szöveg."), (1, None), (0, None)]],
    )
    svc = _ai_service_making_revisions()

    await _run_book_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.DONE
    generatable = scenes_by_chapter[chapter_ids[0]][1]  # the empty+beats scene
    revs = (
        (
            await db_session.execute(
                select(Revision).where(Revision.job_id == job.id)
            )
        )
        .scalars()
        .all()
    )
    assert [r.scene_id for r in revs] == [generatable]
    assert svc.generate_scene_revision.await_count == 1
    assert job.output_data["total_scenes"] == 1
    assert job.output_data["completed"] == 1


@pytest.mark.integration
async def test_book_job_chapter_without_generatable_scenes_is_skipped(
    db_session: AsyncSession,
):
    """A middle chapter with nothing to generate → a skipped entry (with a
    reason) and the loop CONTINUES to the next chapter."""
    job, chapter_ids, scenes_by_chapter = await _make_book_job(
        db_session,
        chapters=[[(1, None)], [(1, "Kész jelenet.")], [(1, None)]],
    )
    svc = _ai_service_making_revisions()

    await _run_book_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.DONE
    out = job.output_data
    assert out["total_chapters"] == 3
    assert out["completed_chapters"] == 2
    # Exactly one skipped entry, for the middle chapter, with a reason.
    assert len(out["skipped"]) == 1
    skipped = out["skipped"][0]
    assert skipped["chapter_id"] == str(chapter_ids[1])
    assert skipped["status"] == "skipped"
    assert skipped["reason"]
    # The 1st and 3rd chapters were still generated (the loop continued).
    assert [c["chapter_id"] for c in out["chapters"]] == [
        str(chapter_ids[0]),
        str(chapter_ids[2]),
    ]
    revs = (
        (
            await db_session.execute(
                select(Revision).where(Revision.job_id == job.id)
            )
        )
        .scalars()
        .all()
    )
    assert {r.scene_id for r in revs} == {
        scenes_by_chapter[chapter_ids[0]][0],
        scenes_by_chapter[chapter_ids[2]][0],
    }


@pytest.mark.integration
async def test_book_job_failing_scene_is_isolated_book_continues(
    db_session: AsyncSession,
):
    """A scene whose generation RAISES is isolated: its chapter CONTINUES, the
    NEXT chapter still runs, and the book ends DONE with partials. Mutation
    guard: if a scene failure aborted the chapter or the book, the later scenes
    would never run and these counts would be wrong."""
    job, chapter_ids, scenes_by_chapter = await _make_book_job(
        db_session, chapters=[[(1, None), (1, None)], [(1, None)]]
    )
    fail_scene = scenes_by_chapter[chapter_ids[0]][0]  # 1st scene of chapter 1
    svc = AsyncMock()

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

    await _run_book_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.DONE  # partials still finish DONE
    out = job.output_data
    assert out["completed"] == 2
    assert out["failed"] == 1
    assert out["completed_chapters"] == 2
    # ALL 3 scenes were attempted (neither the chapter nor the book aborted).
    assert svc.generate_scene_revision.await_count == 3
    revs = (
        (
            await db_session.execute(
                select(Revision).where(Revision.job_id == job.id)
            )
        )
        .scalars()
        .all()
    )
    assert {r.scene_id for r in revs} == {
        scenes_by_chapter[chapter_ids[0]][1],
        scenes_by_chapter[chapter_ids[1]][0],
    }
    # The failed entry carries a SANITIZED, bounded error in its chapter.
    failed_entry = next(
        e
        for c in out["chapters"]
        for e in c["scenes"]
        if e["scene_id"] == str(fail_scene)
    )
    assert failed_entry["status"] == "failed"
    assert "\n" not in failed_entry["error"]
    assert len(failed_entry["error"]) <= 300


@pytest.mark.integration
async def test_book_job_progress_is_committed_progressively(
    db_session: AsyncSession,
):
    """Book-level counters are persisted after each scene / chapter so the UI
    polls live progress: ``completed`` advances 0→1→2 across scenes and
    ``completed_chapters`` flips 0→1 between chapters."""
    job, _chapter_ids, _scenes = await _make_book_job(
        db_session, chapters=[[(1, None)], [(1, None), (1, None)]]
    )
    svc = AsyncMock()
    seen: list[tuple[int, int]] = []

    async def _gen(db, *, scene, beats, job_id, **kwargs):
        current = await db.get(GenerationJob, job_id)
        out = current.output_data or {}
        # ints are snapshot-frozen at each persisted assignment, so these read
        # the last COMMITTED progress, not in-flight mutations.
        seen.append((out.get("completed", 0), out.get("completed_chapters", 0)))
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

    await _run_book_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    # Scene order: ch1.s1, ch2.s1, ch2.s2 — each sees the PRIOR committed state.
    assert seen == [(0, 0), (1, 1), (2, 1)]


def _ai_cancelling_after_n_scenes(n: int):
    """Mocked AIService: each generate call persists a real revision; the N-th
    call additionally flips the job to CANCELLED (as the cancel endpoint would
    from another session). Later calls would persist more revisions — the loops
    must never make them."""
    svc = AsyncMock()

    async def _gen(db, *, scene, beats, job_id, **kwargs):
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
        if svc.generate_scene_revision.await_count == n:
            current = await db.get(GenerationJob, job_id)
            current.status = JobStatus.CANCELLED
            await db.commit()
        return rev, []

    svc.generate_scene_revision.side_effect = _gen
    return svc


@pytest.mark.integration
async def test_book_job_cancel_between_chapters_keeps_prior_revisions(
    db_session: AsyncSession,
):
    """Cancel lands during chapter 1's LAST scene → the loop stops BEFORE
    chapter 2, chapter 1's revisions are KEPT, and the CANCELLED status is
    preserved (never stomped by DONE)."""
    job, chapter_ids, scenes_by_chapter = await _make_book_job(
        db_session, chapters=[[(1, None), (1, None)], [(1, None)]]
    )
    svc = _ai_cancelling_after_n_scenes(2)  # flip after chapter 1 completes

    await _run_book_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.CANCELLED
    # Chapter 2 never started.
    assert svc.generate_scene_revision.await_count == 2
    revs = (
        (
            await db_session.execute(
                select(Revision).where(Revision.job_id == job.id)
            )
        )
        .scalars()
        .all()
    )
    assert {r.scene_id for r in revs} == set(scenes_by_chapter[chapter_ids[0]])
    out = job.output_data
    assert out["cancelled"] is True
    assert out["completed"] == 2
    assert out["completed_chapters"] == 1
    # No entry for the never-started chapter 2.
    assert [c["chapter_id"] for c in out["chapters"]] == [str(chapter_ids[0])]


@pytest.mark.integration
async def test_book_job_cancel_during_last_scene_not_stomped_by_done(
    db_session: AsyncSession,
):
    """A cancel landing during the very LAST scene of the LAST chapter must not
    be stomped by the final DONE transition."""
    job, _chapter_ids, _scenes = await _make_book_job(
        db_session, chapters=[[(1, None)]]
    )
    svc = _ai_cancelling_after_n_scenes(1)

    await _run_book_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.CANCELLED
    assert job.output_data["cancelled"] is True
    revs = (
        (
            await db_session.execute(
                select(Revision).where(Revision.job_id == job.id)
            )
        )
        .scalars()
        .all()
    )
    assert len(revs) == 1  # the last scene's revision is kept


@pytest.mark.integration
async def test_book_job_already_cancelled_never_starts_work(
    db_session: AsyncSession,
):
    """Entry guard: a book job cancelled BEFORE the worker dequeued it must be a
    no-op — no RUNNING flip, no scene generation at all."""
    job, _chapter_ids, _scenes = await _make_book_job(
        db_session, chapters=[[(1, None)], [(1, None)]]
    )
    job.status = JobStatus.CANCELLED
    await db_session.commit()

    svc = AsyncMock()
    await _run_book_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    svc.generate_scene_revision.assert_not_awaited()
    await db_session.refresh(job)
    assert job.status == JobStatus.CANCELLED


@pytest.mark.integration
async def test_book_job_run_continuity_threads_through(
    db_session: AsyncSession,
):
    """``run_continuity=True`` continuity-checks each GENERATED revision's text
    (not scene.content — the scenes are empty by definition) and records the
    REAL warning count per scene entry."""
    job, chapter_ids, scenes_by_chapter = await _make_book_job(
        db_session, chapters=[[(1, None)], [(1, None)]], run_continuity=True
    )
    svc = _ai_service_making_revisions()
    warnings = [
        {"severity": "warning", "message": "Eltérés A", "entity": "Anna"},
        {"severity": "info", "message": "Megjegyzés B"},
    ]
    svc.analyze_continuity_text = AsyncMock(return_value=(warnings, "ctx"))

    await _run_book_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    await db_session.refresh(job)
    assert job.status == JobStatus.DONE
    # One continuity check per generated scene, on the REVISION's content.
    assert svc.analyze_continuity_text.await_count == 2
    checked = {
        (c.kwargs["scene_id"], c.kwargs["content"])
        for c in svc.analyze_continuity_text.await_args_list
    }
    expected_scenes = {
        scenes_by_chapter[chapter_ids[0]][0],
        scenes_by_chapter[chapter_ids[1]][0],
    }
    assert checked == {(s, f"Generated for {s}") for s in expected_scenes}
    entries = [e for c in job.output_data["chapters"] for e in c["scenes"]]
    assert all(e["warning_count"] == 2 for e in entries)
    assert all(len(e["warnings"]) == 2 for e in entries)


@pytest.mark.integration
async def test_book_job_no_continuity_by_default(db_session: AsyncSession):
    job, _chapter_ids, _scenes = await _make_book_job(
        db_session, chapters=[[(1, None)]]
    )
    svc = _ai_service_making_revisions()

    await _run_book_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    svc.analyze_continuity_text.assert_not_awaited()
    await db_session.refresh(job)
    entries = [e for c in job.output_data["chapters"] for e in c["scenes"]]
    assert entries[0]["warning_count"] == 0


@pytest.mark.integration
async def test_book_job_model_params_thread_through(db_session: AsyncSession):
    job, _chapter_ids, _scenes = await _make_book_job(
        db_session,
        chapters=[[(1, None)]],
        extra_input={
            "model": "ollama/llama3.2",
            "temperature": 0.65,
            "max_tokens": 1234,
        },
    )
    svc = _ai_service_making_revisions()

    await _run_book_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )

    call = svc.generate_scene_revision.await_args_list[0]
    assert call.kwargs["model"] == "ollama/llama3.2"
    assert call.kwargs["temperature"] == 0.65
    assert call.kwargs["max_tokens"] == 1234


@pytest.mark.integration
async def test_book_job_missing_job_is_noop(db_session: AsyncSession):
    svc = AsyncMock()
    await _run_book_generation_job(
        uuid.uuid4(), session_factory=_session_factory(db_session), ai=svc
    )
    svc.generate_scene_revision.assert_not_awaited()


@pytest.mark.integration
async def test_book_job_missing_book_marks_failed(db_session: AsyncSession):
    """A job whose book is gone can't start → FAILED with a message, no scene
    work attempted."""
    job, _chapter_ids, _scenes = await _make_book_job(
        db_session, chapters=[[(1, None)]]
    )
    job.input_data = {**job.input_data, "book_id": str(uuid.uuid4())}
    await db_session.commit()

    svc = AsyncMock()
    await _run_book_generation_job(
        job.id, session_factory=_session_factory(db_session), ai=svc
    )
    await db_session.refresh(job)
    assert job.status == JobStatus.FAILED
    assert job.error_message
    svc.generate_scene_revision.assert_not_awaited()


@pytest.mark.unit
def test_run_book_generation_job_dotted_path_resolves():
    """The dotted path the producer enqueues must resolve to the sync entrypoint
    the worker runs — pins producer/consumer agreement (rename = test fails)."""
    from app.services.job_queue import BOOK_GENERATION_JOB_PATH

    module_path, _, attr = BOOK_GENERATION_JOB_PATH.rpartition(".")
    mod = importlib.import_module(module_path)
    assert getattr(mod, attr) is run_book_generation_job


@pytest.mark.unit
def test_enqueue_book_generation_job_uses_job_uuid_as_rq_id():
    """The producer must enqueue with job_id=str(GenerationJob.id) so a pending
    RQ job is addressable for cancellation (same linkage as the chapter job)."""
    from app.services import job_queue

    job_id = uuid.uuid4()
    with patch.object(job_queue, "get_queue") as mock_get_queue:
        job_queue.enqueue_book_generation_job(job_id)
    mock_get_queue.return_value.enqueue.assert_called_once_with(
        job_queue.BOOK_GENERATION_JOB_PATH, str(job_id), job_id=str(job_id)
    )
