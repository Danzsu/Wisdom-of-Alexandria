import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.revision import RevisionRead
from app.services.crud_revision import (
    approve_revision,
    get_revision,
    list_revisions_for_scene,
    reject_revision,
)

router = APIRouter(prefix="/revisions", tags=["revisions"])


@router.get("", response_model=list[RevisionRead])
async def list_for_scene(
    scene_id: uuid.UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[RevisionRead]:
    if scene_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scene_id query parameter is required",
        )
    return await list_revisions_for_scene(db, scene_id)


@router.get("/{revision_id}", response_model=RevisionRead)
async def get_one(
    revision_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> RevisionRead:
    revision = await get_revision(db, revision_id)
    if revision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Revision not found"
        )
    return revision


@router.post("/{revision_id}/approve", response_model=RevisionRead)
async def approve(
    revision_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> RevisionRead:
    revision = await get_revision(db, revision_id)
    if revision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Revision not found"
        )
    return await approve_revision(db, revision)


@router.post("/{revision_id}/reject", response_model=RevisionRead)
async def reject(
    revision_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> RevisionRead:
    revision = await get_revision(db, revision_id)
    if revision is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Revision not found"
        )
    return await reject_revision(db, revision)
