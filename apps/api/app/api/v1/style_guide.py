import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.style_guide import StyleGuideCreate, StyleGuideRead, StyleGuideUpdate
from app.services.crud_style_guide import (
    create_style_guide,
    delete_style_guide,
    get_style_guide,
    update_style_guide,
    upsert_style_guide,
)
from app.services.crud_project import get_project

router = APIRouter(prefix="/projects/{project_id}/style-guide", tags=["style-guide"])


async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession):
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.post("", response_model=StyleGuideRead, status_code=status.HTTP_201_CREATED)
async def create(
    project_id: uuid.UUID,
    data: StyleGuideCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> StyleGuideRead:
    await _get_project_or_404(project_id, db)
    existing = await get_style_guide(db, project_id)
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Style guide already exists for this project",
        )
    return await create_style_guide(db, project_id, data)


@router.get("", response_model=StyleGuideRead)
async def get_one(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> StyleGuideRead:
    await _get_project_or_404(project_id, db)
    style_guide = await get_style_guide(db, project_id)
    if style_guide is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Style guide not found"
        )
    return style_guide


@router.put("", response_model=StyleGuideRead)
async def upsert(
    project_id: uuid.UUID,
    data: StyleGuideCreate,
    response: Response,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> StyleGuideRead:
    await _get_project_or_404(project_id, db)
    sg, created = await upsert_style_guide(db, project_id, data)
    if created:
        response.status_code = status.HTTP_201_CREATED
    return sg


@router.patch("", response_model=StyleGuideRead)
async def update(
    project_id: uuid.UUID,
    data: StyleGuideUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> StyleGuideRead:
    await _get_project_or_404(project_id, db)
    style_guide = await get_style_guide(db, project_id)
    if style_guide is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Style guide not found"
        )
    return await update_style_guide(db, style_guide, data)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    await _get_project_or_404(project_id, db)
    style_guide = await get_style_guide(db, project_id)
    if style_guide is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Style guide not found"
        )
    await delete_style_guide(db, style_guide)
