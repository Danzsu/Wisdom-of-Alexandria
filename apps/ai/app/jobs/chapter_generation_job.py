"""Async chapter-generation job — the worker-side entrypoint for generating a
chapter scene-by-scene (T3 / deferred MVP #11).

Enqueued by ``POST /ai/chapters/{chapter_id}/generate`` (see
``app.services.job_queue.enqueue_chapter_generation_job``) and run by the RQ
worker OUT of the request path. It opens its OWN async DB session, drives the
PARENT ``GenerationJob`` through pending → running → done, and for each selected
scene calls the reusable ``AIService.generate_scene_revision`` core — linking
EVERY produced ``Revision(approved=False)`` to this PARENT job (HITL preserved:
nothing auto-overwrites the manuscript).

Failure model (mirrors ``index_job`` for the hard-failure path, but adds
per-scene isolation):
  - A job/chapter that is missing or cannot be loaded → the job can't START, so
    it is marked ``FAILED`` (or a clean no-op if the row itself is gone) and the
    exception is NOT re-raised.
  - A SINGLE scene erroring is ISOLATED: that scene's partial work is rolled
    back, the scene is recorded ``failed`` (with a sanitized, bounded error), and
    the loop CONTINUES. The job still ends ``DONE`` with partial results — only a
    couldn't-start error is ``FAILED``.
  - ``output_data`` is committed after EACH scene so the frontend polls live
    per-scene progress.
"""

import asyncio
import logging
import uuid

from alexandria_core.core.errors import safe_error
from alexandria_core.db.session import AsyncSessionLocal
from alexandria_core.models.beat import Beat
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.generation_job import JobStatus
from alexandria_core.models.scene import Scene
from sqlalchemy import select

from app.services.ai_service import AIService, ai_service
from app.services.crud_generation_job import get_job

logger = logging.getLogger(__name__)


def run_chapter_generation_job(job_id: str) -> None:
    """RQ entrypoint (synchronous).

    RQ invokes job functions synchronously, so bridge to the async path via
    ``asyncio.run``. ``job_id`` arrives as a ``str`` (RQ serialization) and is
    parsed back to a UUID. This is the dotted path referenced by
    ``app.services.job_queue.CHAPTER_GENERATION_JOB_PATH``.
    """
    asyncio.run(_run_chapter_generation_job(uuid.UUID(str(job_id))))


async def _run_chapter_generation_job(
    job_id: uuid.UUID,
    *,
    session_factory=AsyncSessionLocal,
    ai: AIService = ai_service,
) -> None:
    """Async core: own session, the pending→running→done state machine, per-scene
    isolation, and sanitized failure handling.

    ``session_factory`` + ``ai`` are injectable so tests drive it against the
    test-DB session with a mocked ``AIService`` — no Redis, no worker process, no
    real LLM.
    """
    async with session_factory() as db:
        job = await get_job(db, job_id)
        if job is None:
            logger.warning("Chapter-generate job %s not found; nothing to do.", job_id)
            return

        # The job can only START if its chapter still exists.
        chapter = (
            await db.get(Chapter, job.chapter_id) if job.chapter_id else None
        )
        if chapter is None:
            job.status = JobStatus.FAILED
            job.error_message = "A fejezet nem található."
            await db.commit()
            logger.error(
                "Chapter-generate job %s: chapter missing; marked failed.", job_id
            )
            return

        job.status = JobStatus.RUNNING
        await db.commit()

        input_data = job.input_data or {}
        raw_scene_ids = input_data.get("scene_ids", [])
        run_continuity = bool(input_data.get("run_continuity", False))
        model = input_data.get("model")
        temperature = input_data.get("temperature")
        max_tokens = input_data.get("max_tokens")
        selected_ids = [uuid.UUID(str(s)) for s in raw_scene_ids]

        # Resolve the selected scenes in story (order_index) order, with their
        # ordered beat descriptions. Only scenes that belong to this chapter AND
        # are in the selection are processed (the endpoint already validated this,
        # but the worker re-resolves defensively).
        ordered_scene_ids = (
            (
                await db.execute(
                    select(Scene.id)
                    .where(
                        Scene.chapter_id == chapter.id,
                        Scene.id.in_(selected_ids),
                    )
                    .order_by(Scene.order_index)
                )
            )
            .scalars()
            .all()
        )

        output_data: dict = {
            "total": len(ordered_scene_ids),
            "completed": 0,
            "failed": 0,
            "skipped": [],
            "scenes": [],
        }
        job.output_data = dict(output_data)
        await db.commit()

        # Resolve scene ids (not ORM instances) so a per-scene rollback — which
        # expires every ORM object bound to this session — can never leave us
        # holding a stale instance whose attribute access triggers a lazy load
        # outside the async greenlet context. Each iteration re-fetches its beats.
        for scene_id in ordered_scene_ids:
            beats = (
                (
                    await db.execute(
                        select(Beat.description)
                        .where(Beat.scene_id == scene_id)
                        .order_by(Beat.order_index)
                    )
                )
                .scalars()
                .all()
            )
            try:
                revision, _entities = await ai.generate_scene_revision(
                    db,
                    scene=scene_id,
                    beats=list(beats),
                    job_id=job_id,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                entry: dict = {
                    "scene_id": str(scene_id),
                    "revision_id": str(revision.id),
                    "status": "done",
                    "warning_count": 0,
                }
                if run_continuity:
                    # Continuity-check the JUST-GENERATED revision text — NOT
                    # scene.content (HITL: the generated draft is an unapproved
                    # Revision and is NOT yet written to scene.content; the default
                    # selection is empty scenes, so reading scene.content would
                    # find nothing). analyze_continuity_text checks arbitrary
                    # content and creates NO child job (no orphan continuity jobs
                    # under the parent). The check is a NON-fatal enhancement — its
                    # failure must not fail the scene's already-committed revision,
                    # so it is guarded separately and records warning_count=0.
                    try:
                        warnings, _ctx = await ai.analyze_continuity_text(
                            db,
                            scene_id=scene_id,
                            content=revision.content,
                            model=model,
                            temperature=temperature,
                            max_tokens=max_tokens,
                        )
                        entry["warning_count"] = len(warnings)
                        entry["warnings"] = warnings
                    except Exception as cexc:  # noqa: BLE001 — continuity is optional
                        # The scene's revision is ALREADY committed (save_revision
                        # commits). A failed analyze_continuity_text leaves only its
                        # own uncommitted RAG/read work to clear; rolling that back
                        # CANNOT revert the committed revision or prior job
                        # progress. Re-load the job because rollback expires the
                        # current instance, then continue with warning_count=0.
                        await db.rollback()
                        job = await get_job(db, job_id)
                        if job is None:
                            logger.warning(
                                "Chapter-generate job %s vanished mid-run; stopping.",
                                job_id,
                            )
                            return
                        entry["warning_count"] = 0
                        entry["continuity_error"] = safe_error(cexc)
                        logger.warning(
                            "Continuity check failed for scene %s in job %s: %s",
                            scene_id,
                            job_id,
                            safe_error(cexc),
                        )
                output_data["completed"] += 1
                output_data["scenes"].append(entry)
            except Exception as exc:  # noqa: BLE001 — isolate, don't abort the loop
                # This scene's partial transaction may be poisoned; roll it back so
                # the progress commit below runs on a clean session, then re-load
                # the job (rollback expires the prior instance) and re-apply our
                # in-memory progress.
                await db.rollback()
                job = await get_job(db, job_id)
                if job is None:
                    logger.warning(
                        "Chapter-generate job %s vanished mid-run; stopping.", job_id
                    )
                    return
                output_data["failed"] += 1
                output_data["scenes"].append(
                    {
                        "scene_id": str(scene_id),
                        "status": "failed",
                        "error": safe_error(exc),
                    }
                )
                logger.error(
                    "Chapter-generate job %s: scene %s failed: %s",
                    job_id,
                    scene_id,
                    safe_error(exc),
                )

            # Persist progress after EACH scene (live polling). Re-assign a fresh
            # dict so SQLAlchemy detects the JSON mutation.
            job.output_data = dict(output_data)
            await db.commit()

        # Partial failures still finish DONE — only a couldn't-START error is
        # FAILED (handled above). The job row is the source of truth the UI polls.
        job.status = JobStatus.DONE
        await db.commit()
