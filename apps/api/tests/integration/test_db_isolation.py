"""Regression guard: the db_session fixture must give TRUE per-test isolation.

The fixture binds the session to an outer transaction and runs in
``join_transaction_mode="create_savepoint"``; rolling that transaction back at
teardown must undo even rows the test ``commit()``-ted. Before that fix, the
fixture's end-of-test ``rollback()`` was a no-op once a test had committed, so
committed rows leaked across tests on the shared session-scoped engine — the bug
class that produced order-dependent failures.

These two tests are ORDER-DEPENDENT BY DESIGN (pytest runs them in definition
order; this repo does not randomize): step 1 commits a uniquely-titled row, step
2 asserts it is GONE. If isolation ever silently regresses, step 2 sees the
leaked row and FAILS — which is the whole point. Passing tests alone do NOT
prove isolation; this pair does.
"""

import pytest
from alexandria_core.models.project import Project
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

_SENTINEL = "ISOLATION-SENTINEL-PROJECT"


async def _sentinel_count(db: AsyncSession) -> int:
    return (
        await db.execute(
            select(func.count())
            .select_from(Project)
            .where(Project.title == _SENTINEL)
        )
    ).scalar_one()


@pytest.mark.integration
async def test_isolation_step1_commits_a_sentinel(db_session: AsyncSession):
    """Commit a sentinel project. It is visible within THIS test, but the
    fixture's outer-transaction rollback must discard it at teardown."""
    db_session.add(Project(title=_SENTINEL))
    await db_session.commit()
    assert await _sentinel_count(db_session) == 1


@pytest.mark.integration
async def test_isolation_step2_does_not_see_step1_commit(db_session: AsyncSession):
    """If step 1's commit was correctly rolled back, the sentinel is gone. A
    non-zero count means committed rows leak across tests — isolation broken."""
    assert await _sentinel_count(db_session) == 0
