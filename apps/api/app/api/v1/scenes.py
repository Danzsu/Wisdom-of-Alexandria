import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.chapter import Chapter
from app.schemas.scene import SceneCreate, SceneRead, SceneReorder, SceneUpdate
from app.services.crud_scene import (
    archive_scene, create_scene, delete_scene, get_scene,
    list_scenes, reorder_scenes, unarchive_scene, update_scene,
)

router = APIRouter(prefix="/chapters/{chapter_id}/scenes", tags=["scenes"])


async def _get_chapter_or_404(chapter_id: uuid.UUID, db: AsyncSession):
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if chapter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    return chapter


@router.post("", response_model=SceneRead, status_code=status.HTTP_201_CREATED)
async def create(
    chapter_id: uuid.UUID,
    data: SceneCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SceneRead:
    await _get_chapter_or_404(chapter_id, db)
    return await create_scene(db, chapter_id, data)


@router.get("", response_model=list[SceneRead])
async def list_all(
    chapter_id: uuid.UUID,
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[SceneRead]:
    await _get_chapter_or_404(chapter_id, db)
    return await list_scenes(db, chapter_id, include_archived=include_archived)


@router.post("/reorder", response_model=list[SceneRead])
async def reorder(
    chapter_id: uuid.UUID,
    data: SceneReorder,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[SceneRead]:
    await _get_chapter_or_404(chapter_id, db)
    return await reorder_scenes(db, chapter_id, data.order)


@router.get("/{scene_id}", response_model=SceneRead)
async def get_one(
    chapter_id: uuid.UUID,
    scene_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SceneRead:
    await _get_chapter_or_404(chapter_id, db)
    scene = await get_scene(db, chapter_id, scene_id)
    if scene is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    return scene


@router.patch("/{scene_id}", response_model=SceneRead)
async def update(
    chapter_id: uuid.UUID,
    scene_id: uuid.UUID,
    data: SceneUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SceneRead:
    await _get_chapter_or_404(chapter_id, db)
    scene = await get_scene(db, chapter_id, scene_id)
    if scene is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    return await update_scene(db, scene, data)


@router.delete("/{scene_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    chapter_id: uuid.UUID,
    scene_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    await _get_chapter_or_404(chapter_id, db)
    scene = await get_scene(db, chapter_id, scene_id)
    if scene is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    await delete_scene(db, scene)


@router.post("/{scene_id}/archive", response_model=SceneRead)
async def archive(
    chapter_id: uuid.UUID,
    scene_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SceneRead:
    await _get_chapter_or_404(chapter_id, db)
    scene = await get_scene(db, chapter_id, scene_id)
    if scene is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    return await archive_scene(db, scene)


@router.post("/{scene_id}/unarchive", response_model=SceneRead)
async def unarchive(
    chapter_id: uuid.UUID,
    scene_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SceneRead:
    await _get_chapter_or_404(chapter_id, db)
    scene = await get_scene(db, chapter_id, scene_id)
    if scene is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    return await unarchive_scene(db, scene)
