"""Async RAG index job — the worker-side entrypoint for project re-indexing.

Enqueued by ``POST /ai/index/async`` (see ``app.services.job_queue``) and run by
the RQ worker OUT of the request path. It opens its OWN async DB session, drives
the ``GenerationJob`` through pending -> running -> done/failed, and writes the
``EmbeddingService.sync_project`` counts into ``output_data``.

Failure handling is loud-but-safe: the job is persisted as ``failed`` with a
sanitized, bounded ``error_message`` (never a secret/traceback), the poisoned
transaction is rolled back so that write can commit cleanly, and the exception
is NOT re-raised — the GenerationJob row is the single source of truth the
frontend polls, so re-raising would only risk the worker's default handler
logging a raw (possibly secret-bearing) traceback.

Cooperative cancellation (POST /jobs/{id}/cancel): the work phase is ONE
monolithic ``sync_project`` call, so mid-work interruption is not possible —
the checks are (a) at ENTRY, before the RUNNING flip (an already-cancelled row
never starts the work), and (b) BEFORE the terminal DONE/FAILED write (a cancel
landing mid-work is never stomped). A row DELETED mid-run stops gracefully.
"""

import asyncio
import logging
import uuid

from alexandria_core.core.errors import safe_error
from alexandria_core.db.session import AsyncSessionLocal
from alexandria_core.models.generation_job import JobStatus

from app.services.crud_generation_job import get_job
from app.services.embedding_service import EmbeddingService, SyncResult, embedding_service

logger = logging.getLogger(__name__)

# The job row was deleted out from under a running job (DELETE /jobs/{id}).
_VANISHED_LOG = "Index job %s vanished mid-run; stopping."


def run_index_job(job_id: str) -> None:
    """RQ entrypoint (synchronous).

    RQ invokes job functions synchronously, so bridge to the async indexing path
    via ``asyncio.run``. ``job_id`` arrives as a ``str`` (RQ serialization) and is
    parsed back to a UUID. This is the dotted path referenced by
    ``app.services.job_queue.INDEX_JOB_PATH``.
    """
    asyncio.run(_run_index_job(uuid.UUID(str(job_id))))


async def _run_index_job(
    job_id: uuid.UUID,
    *,
    session_factory=AsyncSessionLocal,
    embeddings: EmbeddingService = embedding_service,
) -> None:
    """Async core: own session, the pending->running->done/failed state machine,
    and sanitized failure handling.

    ``session_factory`` + ``embeddings`` are injectable so tests can drive it
    against the test-DB session and a mocked embedding service — no Redis, no
    real worker process required.
    """
    async with session_factory() as db:
        job = await get_job(db, job_id)
        if job is None:
            logger.warning("Index job %s not found; nothing to do.", job_id)
            return
        if job.status == JobStatus.CANCELLED:
            # Cancelled before the worker dequeued it (the best-effort RQ cancel
            # raced or failed) — never start the work, never flip to RUNNING.
            logger.info("Index job %s already cancelled; not starting.", job_id)
            return
        if job.project_id is None:
            # Defensive: an index job must carry a project scope. Record + stop.
            job.status = JobStatus.FAILED
            job.error_message = "Az indexelési feladathoz hiányzik a projekt."
            await db.commit()
            logger.error("Index job %s has no project_id; marked failed.", job_id)
            return

        job.status = JobStatus.RUNNING
        await db.commit()

        try:
            model = await embeddings.resolve_embedding_model(db)
            if model is None:
                # RAG unconfigured (no embedding provider) — a no-op success, not
                # an error (cloud embeddings are optional).
                result = SyncResult(skipped_no_provider=True)
            else:
                result = await embeddings.sync_project(
                    db, job.project_id, embedding_model=model
                )
            # COOPERATIVE CANCELLATION (terminal protection): a cancel landing
            # DURING the sync must not be stomped by the DONE transition —
            # re-read the persisted status before the terminal write.
            try:
                await db.refresh(job)
            except Exception:  # noqa: BLE001 — row deleted mid-run → stop cleanly
                logger.warning(_VANISHED_LOG, job_id)
                return
            if job.status == JobStatus.CANCELLED:
                logger.info(
                    "Index job %s cancelled mid-run; not overwriting with DONE.",
                    job_id,
                )
                return
            job.output_data = result.as_dict()
            job.status = JobStatus.DONE
            await db.commit()
        except Exception as exc:
            # The sync_project transaction may be poisoned; roll back so the
            # status/error update commits on a clean session, then re-load the
            # job (rollback expires the prior instance).
            await db.rollback()
            failed = await get_job(db, job_id)
            if failed is None:
                logger.warning(_VANISHED_LOG, job_id)
            elif failed.status == JobStatus.CANCELLED:
                # Terminal protection for the failure path too: a cancel that
                # landed mid-work is never stomped by FAILED.
                logger.info(
                    "Index job %s cancelled mid-run; not overwriting with FAILED.",
                    job_id,
                )
            else:
                failed.status = JobStatus.FAILED
                failed.error_message = safe_error(exc)
                await db.commit()
            # Log a SANITIZED message only — never logger.exception(), whose raw
            # traceback could embed a provider secret.
            logger.error("Index job %s failed: %s", job_id, safe_error(exc))
