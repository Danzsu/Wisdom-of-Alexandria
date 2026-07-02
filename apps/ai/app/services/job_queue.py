"""RQ enqueue helpers for AI background jobs.

A thin wrapper around the RQ ``ai`` queue so the producer (API endpoints) and the
consumer (``app.worker``) agree on the queue name + Redis URL through one place,
and so tests can mock enqueueing without a live Redis.

The job function is referenced by its DOTTED PATH (a string), not imported here —
the worker process imports and runs it. This keeps the request-path module free
of the worker's heavy imports and avoids an import cycle.
"""

import logging
import uuid

from alexandria_core.core.config import settings
from redis import Redis
from rq import Queue
from rq.exceptions import NoSuchJobError
from rq.job import Job

from app.worker import QUEUE_NAME

logger = logging.getLogger(__name__)

# Dotted path to the worker job function, resolved by RQ in the worker process.
INDEX_JOB_PATH = "app.jobs.index_job.run_index_job"
IMAGE_JOB_PATH = "app.jobs.image_job.run_image_job"
CHAPTER_GENERATION_JOB_PATH = (
    "app.jobs.chapter_generation_job.run_chapter_generation_job"
)


def get_queue() -> Queue:
    """RQ Queue bound to the configured Redis + AI queue.

    ``Redis.from_url`` is lazy — no socket is opened here; the connection is used
    only when ``enqueue`` actually talks to Redis.
    """
    return Queue(QUEUE_NAME, connection=Redis.from_url(settings.redis_url))


def enqueue_index_job(job_id: uuid.UUID) -> None:
    """Enqueue the async RAG index job for ``job_id`` onto the AI queue.

    The only argument is the GenerationJob id, passed as a ``str`` so it survives
    RQ's serialization; the worker re-parses it to a UUID. The RQ job id is set
    to the SAME uuid string so a queued job is addressable (``cancel_rq_job``)
    without storing a separate linkage.
    """
    get_queue().enqueue(INDEX_JOB_PATH, str(job_id), job_id=str(job_id))


def enqueue_chapter_generation_job(job_id: uuid.UUID) -> None:
    """Enqueue the async chapter-generation job for ``job_id`` onto the AI queue.

    The only argument is the parent GenerationJob id, passed as a ``str`` so it
    survives RQ's serialization; the worker re-parses it to a UUID. The RQ job id
    is set to the SAME uuid string so a queued job is addressable
    (``cancel_rq_job``) without storing a separate linkage.
    """
    get_queue().enqueue(CHAPTER_GENERATION_JOB_PATH, str(job_id), job_id=str(job_id))


def enqueue_image_job(job_id: uuid.UUID) -> None:
    """Enqueue the async Codex image-generation job for ``job_id`` onto the AI
    queue.

    The only argument is the GenerationJob id, passed as a ``str`` so it survives
    RQ's serialization; the worker re-parses it to a UUID. The RQ job id is set
    to the SAME uuid string so a queued job is addressable (``cancel_rq_job``)
    without storing a separate linkage.
    """
    get_queue().enqueue(IMAGE_JOB_PATH, str(job_id), job_id=str(job_id))


def cancel_rq_job(job_id: uuid.UUID) -> bool:
    """Best-effort cancel of the queued RQ job for ``job_id``.

    The RQ job id equals the GenerationJob uuid string (see the enqueue helpers),
    so no stored linkage is needed. Returns ``True`` when the RQ job was found
    and cancelled. ``False`` — WITHOUT raising — when the RQ job no longer exists
    (already dequeued / expired; NOTE: jobs enqueued before the ``job_id=``
    linkage shipped carry an RQ-generated id and are also unfindable) or Redis is
    unreachable: the caller still marks the DB row cancelled, and the worker
    no-ops / stops cooperatively on a cancelled row.
    """
    try:
        rq_job = Job.fetch(str(job_id), connection=Redis.from_url(settings.redis_url))
        rq_job.cancel()
        return True
    except NoSuchJobError:
        logger.info("RQ job %s not found; nothing to dequeue.", job_id)
        return False
    except Exception as exc:  # noqa: BLE001 — best-effort: Redis down must not block
        logger.warning("RQ cancel failed for job %s: %s", job_id, exc)
        return False
