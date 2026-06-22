"""Async Codex image-generation job — the worker-side entrypoint.

Enqueued by the image-generation endpoint (see ``app.services.job_queue``) and
run by the RQ worker OUT of the request path. It opens its OWN async DB session,
drives the ``GenerationJob`` through pending -> running -> done/failed, and writes
the created MediaAsset id into ``output_data``.

Failure handling mirrors ``app.jobs.index_job``: the job is persisted as
``failed`` with a sanitized, bounded ``error_message`` (never a secret/traceback),
the poisoned transaction is rolled back so that write can commit cleanly, and the
exception is NOT re-raised — the GenerationJob row is the single source of truth
the frontend polls, so re-raising would only risk the worker's default handler
logging a raw (possibly secret-bearing) traceback.
"""

import asyncio
import logging
import uuid

from alexandria_core.core.errors import safe_error
from alexandria_core.db.session import AsyncSessionLocal
from alexandria_core.models.generation_job import JobStatus

from app.services.crud_generation_job import get_job
from app.services.image_service import ImageService, image_service

logger = logging.getLogger(__name__)

# Required keys in ``GenerationJob.input_data`` for an image job.
_REQUIRED_INPUT = ("entity_type", "entity_id", "style", "model")


def run_image_job(job_id: str) -> None:
    """RQ entrypoint (synchronous).

    RQ invokes job functions synchronously, so bridge to the async generation
    path via ``asyncio.run``. ``job_id`` arrives as a ``str`` (RQ serialization)
    and is parsed back to a UUID. This is the dotted path referenced by
    ``app.services.job_queue.IMAGE_JOB_PATH``.
    """
    asyncio.run(_run_image_job(uuid.UUID(str(job_id))))


async def _run_image_job(
    job_id: uuid.UUID,
    *,
    session_factory=AsyncSessionLocal,
    images: ImageService = image_service,
) -> None:
    """Async core: own session, the pending->running->done/failed state machine,
    and sanitized failure handling.

    ``session_factory`` + ``images`` are injectable so tests can drive it against
    the test-DB session and a mocked image service — no Redis, no real worker
    process required.
    """
    async with session_factory() as db:
        job = await get_job(db, job_id)
        if job is None:
            logger.warning("Image job %s not found; nothing to do.", job_id)
            return

        params = job.input_data or {}
        missing = [k for k in _REQUIRED_INPUT if not params.get(k)]
        if missing:
            # Defensive: the producer is expected to populate input_data; record
            # the contract violation as a clean failure instead of crashing.
            job.status = JobStatus.FAILED
            job.error_message = (
                "A képgenerálási feladatból hiányzó mező: " + ", ".join(missing)
            )
            await db.commit()
            logger.error("Image job %s missing input fields: %s", job_id, missing)
            return

        job.status = JobStatus.RUNNING
        await db.commit()

        try:
            asset = await images.generate_for_entity(
                db,
                project_id=job.project_id,
                entity_type=params["entity_type"],
                entity_id=uuid.UUID(str(params["entity_id"])),
                style=params["style"],
                model=params["model"],
                job_id=job.id,
            )
            job.output_data = {"media_asset_id": str(asset.id)}
            job.status = JobStatus.DONE
            await db.commit()
        except Exception as exc:
            # The generate transaction may be poisoned; roll back so the
            # status/error update commits on a clean session, then re-load the
            # job (rollback expires the prior instance).
            await db.rollback()
            failed = await get_job(db, job_id)
            if failed is not None:
                failed.status = JobStatus.FAILED
                failed.error_message = safe_error(exc)
                await db.commit()
            # Log a SANITIZED message only — never logger.exception(), whose raw
            # traceback could embed a provider secret.
            logger.error("Image job %s failed: %s", job_id, safe_error(exc))
