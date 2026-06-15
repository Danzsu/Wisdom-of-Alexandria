import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.crud_project import (
    create_project,
    delete_project,
    get_project,
    list_projects,
    update_project,
)

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
async def create(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ProjectRead:
    return await create_project(db, data)


@router.get("", response_model=list[ProjectRead])
async def list_all(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[ProjectRead]:
    return await list_projects(db, skip=skip, limit=limit)


@router.get("/{project_id}", response_model=ProjectRead)
async def get_one(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ProjectRead:
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
async def update(
    project_id: uuid.UUID,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ProjectRead:
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return await update_project(db, project, data)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    await delete_project(db, project)
