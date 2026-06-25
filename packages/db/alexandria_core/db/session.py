from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from alexandria_core.core.config import settings

# ``pool_pre_ping`` validates a pooled connection with a lightweight liveness
# check before handing it out, so a connection gone stale (e.g. after a DB
# restart or an idle-timeout drop) is transparently recycled instead of raising
# on the next query.
engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(
    engine, expire_on_commit=False, class_=AsyncSession
)
