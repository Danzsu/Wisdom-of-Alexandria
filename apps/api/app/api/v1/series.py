import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.series import SeriesCreate, SeriesRead, SeriesUpdate
from app.services.crud_project import get_project
from app.services.crud_series import (
    create_series,
    delete_series,
    get_series,
    list_series,
    update_series,
)

router = APIRouter(prefix="/projects/{project_id}/series", tags=["series"])


async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession):
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


async def _get_series_or_404(
    project_id: uuid.UUID, series_id: uuid.UUID, db: AsyncSession
):
    series = await get_series(db, project_id, series_id)
    if series is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Series not found")
    return series


@router.post("", response_model=SeriesRead, status_code=status.HTTP_201_CREATED)
async def create(
    project_id: uuid.UUID,
    data: SeriesCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SeriesRead:
    await _get_project_or_404(project_id, db)
    return await create_series(db, project_id, data)


@router.get("", response_model=list[SeriesRead])
async def list_all(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[SeriesRead]:
    await _get_project_or_404(project_id, db)
    return await list_series(db, project_id)


@router.get("/{series_id}", response_model=SeriesRead)
async def get_one(
    project_id: uuid.UUID,
    series_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SeriesRead:
    await _get_project_or_404(project_id, db)
    return await _get_series_or_404(project_id, series_id, db)


@router.patch("/{series_id}", response_model=SeriesRead)
async def update(
    project_id: uuid.UUID,
    series_id: uuid.UUID,
    data: SeriesUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SeriesRead:
    await _get_project_or_404(project_id, db)
    series = await _get_series_or_404(project_id, series_id, db)
    return await update_series(db, series, data)


@router.delete("/{series_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    project_id: uuid.UUID,
    series_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    await _get_project_or_404(project_id, db)
    series = await _get_series_or_404(project_id, series_id, db)
    await delete_series(db, series)
