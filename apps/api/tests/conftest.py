import os

# Provider-secret encryption requires PROVIDER_ENCRYPTION_KEY. There is
# intentionally no committed default in app/core/config.py (the production key
# is supplied via the environment and never committed). Tests supply their OWN
# throwaway key here. This MUST run before any `app.*` import, because
# app.core.config instantiates `settings = Settings()` at module import time and
# would otherwise capture an unset key. `setdefault` lets a CI/dev key win if
# one is already exported.
os.environ.setdefault(
    "PROVIDER_ENCRYPTION_KEY", "vxmdDzJKYCa9wvZok_7P_IRdJUGtJDRCHaFW1eaQ4Vk="
)

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    create_async_engine,
)

from app.main import app  # noqa: E402

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", "sqlite+aiosqlite:///./test.db"
)
IS_POSTGRES = TEST_DATABASE_URL.startswith("postgresql")


@pytest.fixture(scope="session")
async def engine_fixture():
    import alexandria_core.models  # noqa: F401 — register all models
    from alexandria_core.models.base import Base  # noqa: F401

    test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield test_engine
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest.fixture
async def db_session(engine_fixture):
    # Per-test isolation. Bind the session to ONE connection inside an outer
    # transaction and run it in "create_savepoint" mode: the code under test can
    # call commit()/rollback() (which release / roll back a SAVEPOINT) WITHOUT
    # ever committing the OUTER transaction. Rolling that outer transaction back
    # at teardown undoes everything the test wrote, so committed rows never leak
    # across tests on the shared session-scoped engine (the prior fixture's
    # end-of-test rollback() was a no-op once a test had committed).
    async with engine_fixture.connect() as conn:
        trans = await conn.begin()
        session = AsyncSession(
            bind=conn,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        try:
            yield session
        finally:
            await session.close()
            await trans.rollback()


@pytest.fixture
async def client(db_session: AsyncSession):
    from app.core.deps import get_db

    app.dependency_overrides[get_db] = lambda: db_session

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    from alexandria_core.core.config import settings
    resp = await client.post(
        "/api/v1/auth/token",
        data={"username": settings.admin_username, "password": settings.admin_password},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
