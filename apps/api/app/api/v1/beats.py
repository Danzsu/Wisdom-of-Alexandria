import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.scene import Scene
from app.schemas.beat import BeatCreate, BeatRead, BeatReorder, BeatUpdate
from app.services.crud_beat import (
    create_beat, delete_beat, get_beat, list_beats, reorder_beats, update_beat
)

router = APIRouter(prefix="/scenes/{scene_id}/beats", tags=["beats"])


async def _get_scene_or_404(scene_id: uuid.UUID, db: AsyncSession):
    result = await db.execute(select(Scene).where(Scene.id == scene_id))
    scene = result.scalar_one_or_none()
    if scene is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    return scene


@router.post("", response_model=BeatRead, status_code=status.HTTP_201_CREATED)
async def create(
    scene_id: uuid.UUID,
    data: BeatCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> BeatRead:
    await _get_scene_or_404(scene_id, db)
    return await create_beat(db, scene_id, data)


@router.get("", response_model=list[BeatRead])
async def list_all(
    scene_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[BeatRead]:
    await _get_scene_or_404(scene_id, db)
    return await list_beats(db, scene_id)


@router.post("/reorder", response_model=list[BeatRead])
async def reorder(
    scene_id: uuid.UUID,
    data: BeatReorder,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[BeatRead]:
    await _get_scene_or_404(scene_id, db)
    return await reorder_beats(db, scene_id, data.order)


@router.get("/{beat_id}", response_model=BeatRead)
async def get_one(
    scene_id: uuid.UUID,
    beat_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> BeatRead:
    await _get_scene_or_404(scene_id, db)
    beat = await get_beat(db, scene_id, beat_id)
    if beat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Beat not found")
    return beat


@router.patch("/{beat_id}", response_model=BeatRead)
async def update(
    scene_id: uuid.UUID,
    beat_id: uuid.UUID,
    data: BeatUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> BeatRead:
    await _get_scene_or_404(scene_id, db)
    beat = await get_beat(db, scene_id, beat_id)
    if beat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Beat not found")
    return await update_beat(db, beat, data)


@router.delete("/{beat_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    scene_id: uuid.UUID,
    beat_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    await _get_scene_or_404(scene_id, db)
    beat = await get_beat(db, scene_id, beat_id)
    if beat is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Beat not found")
    await delete_beat(db, beat)
