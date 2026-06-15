"""RQ worker entrypoint for the Alexandria AI service.

Background AI jobs (e.g. full-book generation in V1) are enqueued onto Redis and
processed here, out-of-band from the request path. RQ is not actively enqueued
yet in the MVP — this entrypoint exists so the ``worker`` container can boot and
listen on the queue, ready for the first enqueued job.

Run with either:
    rq worker --url "$REDIS_URL" ai
    python -m app.worker
The two are equivalent; this module is the canonical, importable form used by
the Docker image so the queue name and Redis URL come from one place.
"""

from alexandria_core.core.config import settings
from redis import Redis
from rq import Queue, Worker

# Single MVP queue. AI generation jobs are enqueued here from the API/AI service
# and consumed by this worker. Kept as a named constant so producer + consumer
# never drift.
QUEUE_NAME = "ai"


def build_worker() -> Worker:
    """Construct an RQ Worker bound to the configured Redis + AI queue.

    ``Redis.from_url`` is lazy — it does not open a socket — so a misconfigured
    ``REDIS_URL`` would let the worker boot "healthy" and only fail on the first
    enqueued job. We eagerly ``ping()`` here so a bad connection fails loudly at
    startup with a clear error rather than silently later. ``ping()`` raises
    ``redis.exceptions.ConnectionError`` on failure, which is allowed to
    propagate (not swallowed).
    """
    redis_conn = Redis.from_url(settings.redis_url)
    redis_conn.ping()
    queue = Queue(QUEUE_NAME, connection=redis_conn)
    return Worker([queue], connection=redis_conn)


def main() -> None:
    build_worker().work(with_scheduler=True)


if __name__ == "__main__":
    main()
