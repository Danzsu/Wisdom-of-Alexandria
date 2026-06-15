import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.location import LocationCreate, LocationRead, LocationUpdate
from app.services.crud_location import (
    create_location,
    delete_location,
    get_location,
    list_locations,
    update_location,
)
from app.services.crud_project import get_project

router = APIRouter(prefix="/projects/{project_id}/locations", tags=["locations"])


async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession):
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.post("", response_model=LocationRead, status_code=status.HTTP_201_CREATED)
async def create(
    project_id: uuid.UUID,
    data: LocationCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> LocationRead:
    await _get_project_or_404(project_id, db)
    return await create_location(db, project_id, data)


@router.get("", response_model=list[LocationRead])
async def list_all(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[LocationRead]:
    await _get_project_or_404(project_id, db)
    return await list_locations(db, project_id)


@router.get("/{location_id}", response_model=LocationRead)
async def get_one(
    project_id: uuid.UUID,
    location_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> LocationRead:
    await _get_project_or_404(project_id, db)
    location = await get_location(db, project_id, location_id)
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    return location


@router.patch("/{location_id}", response_model=LocationRead)
async def update(
    project_id: uuid.UUID,
    location_id: uuid.UUID,
    data: LocationUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> LocationRead:
    await _get_project_or_404(project_id, db)
    location = await get_location(db, project_id, location_id)
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    return await update_location(db, location, data)


@router.delete("/{location_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    project_id: uuid.UUID,
    location_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    await _get_project_or_404(project_id, db)
    location = await get_location(db, project_id, location_id)
    if location is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Location not found")
    await delete_location(db, location)
