"""Engine configuration guard (P2 hardening).

The async engine MUST enable ``pool_pre_ping`` so a stale pooled connection
(e.g. after the DB restarts) is transparently validated + recycled instead of
surfacing a hard error on the next query. SQLAlchemy exposes this as
``engine.pool._pre_ping``.
"""

from alexandria_core.db.session import engine


def test_engine_has_pool_pre_ping_enabled():
    # SQLAlchemy stores the pre-ping flag on the pool as ``_pre_ping``.
    assert getattr(engine.pool, "_pre_ping", False) is True
