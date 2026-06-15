import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.provider import Provider
from app.schemas.provider import (
    ProviderCreate,
    ProviderModelsResult,
    ProviderRead,
    ProviderTestResult,
    ProviderUpdate,
)
from app.services.crud_provider import (
    create_provider,
    delete_provider,
    get_provider,
    list_providers,
    to_read,
    update_provider,
)
from app.services.provider_service import check_provider, list_provider_models

router = APIRouter(prefix="/providers", tags=["providers"])


async def _get_provider_or_404(provider_id: uuid.UUID, db: AsyncSession) -> Provider:
    provider = await get_provider(db, provider_id)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    return provider


@router.post("", response_model=ProviderRead, status_code=status.HTTP_201_CREATED)
async def create(
    data: ProviderCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ProviderRead:
    provider = await create_provider(db, data)
    return to_read(provider)


@router.get("", response_model=list[ProviderRead])
async def list_all(
    enabled_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[ProviderRead]:
    providers = await list_providers(db, enabled_only=enabled_only)
    return [to_read(p) for p in providers]


@router.get("/{provider_id}", response_model=ProviderRead)
async def get_one(
    provider_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ProviderRead:
    provider = await _get_provider_or_404(provider_id, db)
    return to_read(provider)


@router.patch("/{provider_id}", response_model=ProviderRead)
async def update(
    provider_id: uuid.UUID,
    data: ProviderUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ProviderRead:
    provider = await _get_provider_or_404(provider_id, db)
    provider = await update_provider(db, provider, data)
    return to_read(provider)


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    provider_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    provider = await _get_provider_or_404(provider_id, db)
    await delete_provider(db, provider)


@router.post("/{provider_id}/test", response_model=ProviderTestResult)
async def test_connection(
    provider_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ProviderTestResult:
    provider = await _get_provider_or_404(provider_id, db)
    return await check_provider(provider)


@router.get("/{provider_id}/models", response_model=ProviderModelsResult)
async def models(
    provider_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ProviderModelsResult:
    provider = await _get_provider_or_404(provider_id, db)
    found = await list_provider_models(provider)
    return ProviderModelsResult(models=found)
