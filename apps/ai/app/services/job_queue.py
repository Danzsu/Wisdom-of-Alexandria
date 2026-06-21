"""RQ enqueue helpers for AI background jobs.

A thin wrapper around the RQ ``ai`` queue so the producer (API endpoints) and the
consumer (``app.worker``) agree on the queue name + Redis URL through one place,
and so tests can mock enqueueing without a live Redis.

The job function is referenced by its DOTTED PATH (a string), not imported here —
the worker process imports and runs it. This keeps the request-path module free
of the worker's heavy imports and avoids an import cycle.
"""

import uuid

from alexandria_core.core.config import settings
from redis import Redis
from rq import Queue

from app.worker import QUEUE_NAME

# Dotted path to the worker job function, resolved by RQ in the worker process.
INDEX_JOB_PATH = "app.jobs.index_job.run_index_job"


def get_queue() -> Queue:
    """RQ Queue bound to the configured Redis + AI queue.

    ``Redis.from_url`` is lazy — no socket is opened here; the connection is used
    only when ``enqueue`` actually talks to Redis.
    """
    return Queue(QUEUE_NAME, connection=Redis.from_url(settings.redis_url))


def enqueue_index_job(job_id: uuid.UUID) -> None:
    """Enqueue the async RAG index job for ``job_id`` onto the AI queue.

    The only argument is the GenerationJob id, passed as a ``str`` so it survives
    RQ's serialization; the worker re-parses it to a UUID.
    """
    get_queue().enqueue(INDEX_JOB_PATH, str(job_id))
