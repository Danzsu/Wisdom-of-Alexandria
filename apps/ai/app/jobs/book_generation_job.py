"""Async book-generation job — the worker-side entrypoint for generating ALL
(selected) chapters of a book, chapter by chapter (V2: book-level chapter
automation).

Enqueued by ``POST /ai/books/{book_id}/generate`` (see
``app.services.job_queue.enqueue_book_generation_job``) and run by the RQ worker
OUT of the request path. A SEQUENTIAL wrapper over the SAME per-scene machinery
the chapter job uses: for each selected chapter (story / ``order_index`` order)
it resolves the SAFE default selection — scenes that are EMPTY (no content) AND
have at least one beat — and drives the shared
``_generate_scenes_for_chapter`` loop, linking every produced
``Revision(approved=False)`` to THIS parent book job (HITL preserved: nothing
auto-overwrites the manuscript). The fine-grained per-scene opt-in remains a
chapter-level feature.

Failure model (mirrors the chapter job, plus per-chapter isolation):
  - A job/book that is missing or cannot be loaded → the job can't START, so it
    is marked ``FAILED`` (or a clean no-op if the row itself is gone).
  - A chapter with NO generatable scene is recorded ``skipped`` (with a reason)
    and the loop CONTINUES.
  - A SINGLE scene erroring is isolated inside its chapter (the shared loop
    records it ``failed`` and continues); the book job still ends ``DONE`` with
    partial results.
  - Book-level ``output_data`` progress (chapter + scene counters and the
    per-chapter ``scenes`` entries) is committed after EACH scene / chapter so
    the frontend polls live progress.

Cooperative cancellation (POST /jobs/{id}/cancel): checked at ENTRY (an
already-cancelled row never starts, never flips to RUNNING), BETWEEN scenes
(inside the shared loop), BETWEEN chapters, and before the final DONE write —
completed revisions are always KEPT and CANCELLED is never stomped.
"""

import asyncio
import logging
import uuid

from alexandria_core.db.session import AsyncSessionLocal
from alexandria_core.models.beat import Beat
from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.generation_job import JobStatus
from alexandria_core.models.scene import Scene
from sqlalchemy import select

from app.jobs.chapter_generation_job import (
    _VANISHED_LOG,
    SCENES_CANCELLED,
    SCENES_VANISHED,
    _generate_scenes_for_chapter,
)
from app.services.ai_service import AIService, ai_service
from app.services.crud_generation_job import get_job

logger = logging.getLogger(__name__)

# Recorded on a chapter the auto-selection finds nothing to generate in.
_SKIP_REASON = "Nincs generálható jelenet (üres jelenet legalább egy beattel)."


def run_book_generation_job(job_id: str) -> None:
    """RQ entrypoint (synchronous).

    RQ invokes job functions synchronously, so bridge to the async path via
    ``asyncio.run``. ``job_id`` arrives as a ``str`` (RQ serialization) and is
    parsed back to a UUID. This is the dotted path referenced by
    ``app.services.job_queue.BOOK_GENERATION_JOB_PATH``.
    """
    asyncio.run(_run_book_generation_job(uuid.UUID(str(job_id))))


async def _resolve_generation_plan(
    db, book_id: uuid.UUID, selected_ids: list[uuid.UUID]
) -> tuple[list[uuid.UUID], dict[uuid.UUID, list[uuid.UUID]]]:
    """Resolve the book job's work plan defensively (the endpoint validated at
    enqueue time, but the worker re-resolves against the CURRENT data).

    Returns ``(ordered_chapter_ids, scenes_by_chapter)``:
      - the selected chapters that still belong to the book, in story
        (``order_index``) order;
      - per chapter, the SAFE default scene selection — EMPTY (``content`` NULL
        or ``""``) scenes with at least one beat — in ``order_index`` order.
    """
    ordered_chapter_ids = (
        (
            await db.execute(
                select(Chapter.id)
                .where(Chapter.book_id == book_id, Chapter.id.in_(selected_ids))
                .order_by(Chapter.order_index)
            )
        )
        .scalars()
        .all()
    )
    scenes_by_chapter: dict[uuid.UUID, list[uuid.UUID]] = {
        chapter_id: [] for chapter_id in ordered_chapter_ids
    }
    # INNER join to Beat + GROUP BY scene → only scenes with >=1 beat survive.
    rows = (
        await db.execute(
            select(Scene.id, Scene.chapter_id)
            .join(Beat, Beat.scene_id == Scene.id)
            .where(
                Scene.chapter_id.in_(ordered_chapter_ids),
                Scene.content.is_(None) | (Scene.content == ""),
            )
            .group_by(Scene.id, Scene.chapter_id, Scene.order_index)
            .order_by(Scene.order_index)
        )
    ).all()
    for scene_id, chapter_id in rows:
        scenes_by_chapter[chapter_id].append(scene_id)
    return list(ordered_chapter_ids), scenes_by_chapter


async def _run_book_generation_job(
    job_id: uuid.UUID,
    *,
    session_factory=AsyncSessionLocal,
    ai: AIService = ai_service,
) -> None:
    """Async core: own session, the pending→running→done state machine, the
    sequential per-chapter loop over the SHARED per-scene generation helper.

    ``session_factory`` + ``ai`` are injectable so tests drive it against the
    test-DB session with a mocked ``AIService`` — no Redis, no worker process,
    no real LLM.
    """
    async with session_factory() as db:
        job = await get_job(db, job_id)
        if job is None:
            logger.warning("Book-generate job %s not found; nothing to do.", job_id)
            return
        if job.status == JobStatus.CANCELLED:
            # Cancelled before the worker dequeued it (the best-effort RQ cancel
            # raced or failed) — never start the work, never flip to RUNNING.
            logger.info(
                "Book-generate job %s already cancelled; not starting.", job_id
            )
            return

        # The job can only START if its book still exists.
        input_data = job.input_data or {}
        raw_book_id = input_data.get("book_id")
        book = (
            await db.get(Book, uuid.UUID(str(raw_book_id))) if raw_book_id else None
        )
        if book is None:
            job.status = JobStatus.FAILED
            job.error_message = "A könyv nem található."
            await db.commit()
            logger.error(
                "Book-generate job %s: book missing; marked failed.", job_id
            )
            return

        job.status = JobStatus.RUNNING
        await db.commit()

        run_continuity = bool(input_data.get("run_continuity", False))
        model = input_data.get("model")
        temperature = input_data.get("temperature")
        max_tokens = input_data.get("max_tokens")
        selected_ids = [uuid.UUID(str(c)) for c in input_data.get("chapter_ids", [])]

        ordered_chapter_ids, scenes_by_chapter = await _resolve_generation_plan(
            db, book.id, selected_ids
        )

        output_data: dict = {
            "total_chapters": len(ordered_chapter_ids),
            "completed_chapters": 0,
            "total_scenes": sum(len(s) for s in scenes_by_chapter.values()),
            "completed": 0,
            "failed": 0,
            "skipped": [],
            "chapters": [],
        }
        job.output_data = dict(output_data)
        await db.commit()

        for chapter_id in ordered_chapter_ids:
            # COOPERATIVE CANCELLATION between chapters (the shared loop also
            # checks between scenes): completed chapters' revisions are KEPT
            # and CANCELLED is preserved (never overwritten by DONE).
            try:
                await db.refresh(job)
            except Exception:  # noqa: BLE001 — row deleted mid-run → stop cleanly
                logger.warning(_VANISHED_LOG, job_id)
                return
            if job.status == JobStatus.CANCELLED:
                output_data["cancelled"] = True
                job.output_data = dict(output_data)
                await db.commit()
                logger.info(
                    "Book-generate job %s cancelled; stopping before chapter %s "
                    "(%d/%d chapters completed).",
                    job_id,
                    chapter_id,
                    output_data["completed_chapters"],
                    output_data["total_chapters"],
                )
                return

            scene_ids = scenes_by_chapter.get(chapter_id, [])
            if not scene_ids:
                # Nothing generatable in this chapter — record and CONTINUE.
                output_data["skipped"].append(
                    {
                        "chapter_id": str(chapter_id),
                        "status": "skipped",
                        "reason": _SKIP_REASON,
                    }
                )
                job.output_data = dict(output_data)
                await db.commit()
                continue

            chapter_entry: dict = {"chapter_id": str(chapter_id), "scenes": []}
            output_data["chapters"].append(chapter_entry)
            # The SAME per-scene loop the chapter job runs — every revision is
            # linked to THIS parent book job; failures are isolated per scene.
            outcome, job, remaining = await _generate_scenes_for_chapter(
                db,
                ai,
                job,
                ordered_scene_ids=list(scene_ids),
                run_continuity=run_continuity,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                output_data=output_data,
                scene_entries=chapter_entry["scenes"],
                counts=output_data,
            )
            if outcome == SCENES_VANISHED:
                return
            if outcome == SCENES_CANCELLED:
                output_data["cancelled"] = True
                chapter_entry["skipped_scene_ids"] = [str(s) for s in remaining]
                job.output_data = dict(output_data)
                await db.commit()
                logger.info(
                    "Book-generate job %s cancelled mid-chapter %s "
                    "(%d/%d scenes completed).",
                    job_id,
                    chapter_id,
                    output_data["completed"],
                    output_data["total_scenes"],
                )
                return

            output_data["completed_chapters"] += 1
            job.output_data = dict(output_data)
            await db.commit()

        # A cancel that landed DURING the last scene must not be stomped by the
        # DONE transition — re-read the persisted status one final time.
        try:
            await db.refresh(job)
        except Exception:  # noqa: BLE001 — row deleted mid-run → stop cleanly
            logger.warning(_VANISHED_LOG, job_id)
            return
        if job.status == JobStatus.CANCELLED:
            output_data["cancelled"] = True
            job.output_data = dict(output_data)
            await db.commit()
            return

        # Partial failures / skipped chapters still finish DONE — only a
        # couldn't-START error is FAILED (handled above).
        job.status = JobStatus.DONE
        await db.commit()
