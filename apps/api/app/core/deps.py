from collections.abc import AsyncGenerator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.session import AsyncSessionLocal
from app.services.model_router import ModelRouter, model_router

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token")


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            # If an endpoint/service raises mid-transaction, roll back so the
            # session isn't left in a failed state (which would make any later
            # commit raise PendingRollbackError and mask the original error).
            await session.rollback()
            raise


async def get_current_user(token: str = Depends(oauth2_scheme)) -> str:
    subject = decode_token(token)
    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return subject


def get_model_router() -> ModelRouter:
    return model_router
