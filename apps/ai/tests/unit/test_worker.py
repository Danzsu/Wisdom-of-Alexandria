"""Unit tests for the RQ worker entrypoint.

FIX 4: ``Redis.from_url`` is lazy, so a misconfigured ``REDIS_URL`` would let the
worker boot "healthy" and only fail on the first enqueued job. ``build_worker()``
must eagerly ``ping()`` so a bad connection fails loudly at startup.
"""

from unittest.mock import MagicMock, patch

import pytest
from redis.exceptions import ConnectionError as RedisConnectionError

from app import worker


@pytest.mark.unit
def test_build_worker_pings_redis_eagerly():
    """build_worker() must call ping() on the connection so a dead Redis is
    detected at startup, not on first job.

    Queue/Worker are patched so we exercise build_worker's wiring (incl. the
    eager ping) without constructing a real RQ Worker against a mock socket.
    """
    mock_conn = MagicMock()
    with (
        patch("app.worker.Redis.from_url", return_value=mock_conn) as mock_from_url,
        patch("app.worker.Queue") as mock_queue,
        patch("app.worker.Worker") as mock_worker,
    ):
        built = worker.build_worker()
    mock_from_url.assert_called_once()
    mock_conn.ping.assert_called_once()
    # Wiring intact: queue + worker bound to the same connection.
    mock_queue.assert_called_once_with(worker.QUEUE_NAME, connection=mock_conn)
    mock_worker.assert_called_once()
    assert built is mock_worker.return_value


@pytest.mark.unit
def test_build_worker_propagates_ping_failure():
    """If ping() raises (bad Redis URL / unreachable), build_worker() must
    propagate it loudly — never swallow and boot anyway. The ping must also
    happen BEFORE the Worker is constructed (fail fast)."""
    mock_conn = MagicMock()
    mock_conn.ping.side_effect = RedisConnectionError("Connection refused")
    with (
        patch("app.worker.Redis.from_url", return_value=mock_conn),
        patch("app.worker.Worker") as mock_worker,
    ):
        with pytest.raises(RedisConnectionError, match="Connection refused"):
            worker.build_worker()
    # Fail fast: no Worker should be built when the connection is dead.
    mock_worker.assert_not_called()
