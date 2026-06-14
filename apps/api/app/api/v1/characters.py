import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.character import CharacterCreate, CharacterRead, CharacterUpdate
from app.services.crud_character import (
    create_character,
    delete_character,
    get_character,
    list_characters,
    update_character,
)
from app.services.crud_project import get_project

router = APIRouter(prefix="/projects/{project_id}/characters", tags=["characters"])


async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession):
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.post("", response_model=CharacterRead, status_code=status.HTTP_201_CREATED)
async def create(
    project_id: uuid.UUID,
    data: CharacterCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CharacterRead:
    await _get_project_or_404(project_id, db)
    return await create_character(db, project_id, data)


@router.get("", response_model=list[CharacterRead])
async def list_all(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[CharacterRead]:
    await _get_project_or_404(project_id, db)
    return await list_characters(db, project_id)


@router.get("/{char_id}", response_model=CharacterRead)
async def get_one(
    project_id: uuid.UUID,
    char_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CharacterRead:
    await _get_project_or_404(project_id, db)
    character = await get_character(db, project_id, char_id)
    if character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
    return character


@router.patch("/{char_id}", response_model=CharacterRead)
async def update(
    project_id: uuid.UUID,
    char_id: uuid.UUID,
    data: CharacterUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CharacterRead:
    await _get_project_or_404(project_id, db)
    character = await get_character(db, project_id, char_id)
    if character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
    return await update_character(db, character, data)


@router.delete("/{char_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    project_id: uuid.UUID,
    char_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    await _get_project_or_404(project_id, db)
    character = await get_character(db, project_id, char_id)
    if character is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
    await delete_character(db, character)
