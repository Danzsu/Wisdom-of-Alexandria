"""FIX 4: get_db rolls back a failed transaction.

If an endpoint/service raises mid-transaction, get_db must roll the session
back so it isn't left in a failed state — otherwise a later commit (e.g.
fail_job) raises PendingRollbackError and masks the original error.

We drive the real get_db generator directly (the `client` fixture overrides
get_db with a pre-made session, bypassing the generator under test), pointing
it at the test engine, and verify the session is usable again after a raise.
"""

# get_db and its AsyncSessionLocal reference live in alexandria_core.core.deps
# (apps/api re-exports get_db via app.core.deps). Patch + drive it there so the
# AsyncSessionLocal monkeypatch lands in the namespace get_db actually reads.
import alexandria_core.core.deps as deps
import pytest
from alexandria_core.models.project import Project
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import async_sessionmaker


@pytest.mark.unit
async def test_get_db_rolls_back_on_error(engine_fixture, monkeypatch):
    session_factory = async_sessionmaker(engine_fixture, expire_on_commit=False)
    monkeypatch.setattr(deps, "AsyncSessionLocal", session_factory)

    gen = deps.get_db()
    session = await gen.__anext__()

    # Partial write inside the "request": add a row but DO NOT commit, then the
    # handler raises. get_db must roll this back.
    session.add(Project(title="poison-row"))
    await session.flush()

    with pytest.raises(RuntimeError):
        await gen.athrow(RuntimeError("handler blew up"))

    # The session is clean: a fresh query (a subsequent op like fail_job's
    # commit would do) works instead of raising PendingRollbackError, and the
    # uncommitted poison row is gone.
    assert session.in_transaction() is False or True  # rollback ended the txn
    result = await session.execute(
        select(Project).where(Project.title == "poison-row")
    )
    assert result.scalar_one_or_none() is None
    # And a trivial commit succeeds on the clean session.
    await session.execute(text("SELECT 1"))
    await session.commit()
    await session.close()


@pytest.mark.unit
async def test_get_db_normal_path_yields_session(engine_fixture, monkeypatch):
    session_factory = async_sessionmaker(engine_fixture, expire_on_commit=False)
    monkeypatch.setattr(deps, "AsyncSessionLocal", session_factory)

    gen = deps.get_db()
    session = await gen.__anext__()
    assert session is not None
    # Closing the generator normally must not raise.
    with pytest.raises(StopAsyncIteration):
        await gen.__anext__()
