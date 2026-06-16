import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.worldbuilding_entry import (
    WorldbuildingEntryCreate,
    WorldbuildingEntryRead,
    WorldbuildingEntryUpdate,
)
from app.services.crud_project import get_project
from app.services.crud_worldbuilding_entry import (
    create_worldbuilding_entry,
    delete_worldbuilding_entry,
    get_worldbuilding_entry,
    list_worldbuilding_entries,
    update_worldbuilding_entry,
)

router = APIRouter(prefix="/projects/{project_id}/worldbuilding", tags=["worldbuilding"])


async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession):
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.post("", response_model=WorldbuildingEntryRead, status_code=status.HTTP_201_CREATED)
async def create(
    project_id: uuid.UUID,
    data: WorldbuildingEntryCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> WorldbuildingEntryRead:
    await _get_project_or_404(project_id, db)
    return await create_worldbuilding_entry(db, project_id, data)


@router.get("", response_model=list[WorldbuildingEntryRead])
async def list_all(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[WorldbuildingEntryRead]:
    await _get_project_or_404(project_id, db)
    return await list_worldbuilding_entries(db, project_id)


@router.get("/{entry_id}", response_model=WorldbuildingEntryRead)
async def get_one(
    project_id: uuid.UUID,
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> WorldbuildingEntryRead:
    await _get_project_or_404(project_id, db)
    entry = await get_worldbuilding_entry(db, project_id, entry_id)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Worldbuilding entry not found"
        )
    return entry


@router.patch("/{entry_id}", response_model=WorldbuildingEntryRead)
async def update(
    project_id: uuid.UUID,
    entry_id: uuid.UUID,
    data: WorldbuildingEntryUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> WorldbuildingEntryRead:
    await _get_project_or_404(project_id, db)
    entry = await get_worldbuilding_entry(db, project_id, entry_id)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Worldbuilding entry not found"
        )
    return await update_worldbuilding_entry(db, entry, data)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    project_id: uuid.UUID,
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    await _get_project_or_404(project_id, db)
    entry = await get_worldbuilding_entry(db, project_id, entry_id)
    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Worldbuilding entry not found"
        )
    await delete_worldbuilding_entry(db, entry)
