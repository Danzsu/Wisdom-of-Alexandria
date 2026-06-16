import uuid

from alexandria_core.models.beat import Beat
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.beat import BeatCreate, BeatUpdate
from app.services.ordering import validate_permutation


async def create_beat(db: AsyncSession, scene_id: uuid.UUID, data: BeatCreate) -> Beat:
    beat = Beat(scene_id=scene_id, **data.model_dump())
    db.add(beat)
    await db.commit()
    await db.refresh(beat)
    return beat


async def get_beat(db: AsyncSession, scene_id: uuid.UUID, beat_id: uuid.UUID) -> Beat | None:
    result = await db.execute(
        select(Beat).where(Beat.id == beat_id, Beat.scene_id == scene_id)
    )
    return result.scalar_one_or_none()


async def list_beats(db: AsyncSession, scene_id: uuid.UUID) -> list[Beat]:
    result = await db.execute(
        select(Beat).where(Beat.scene_id == scene_id).order_by(Beat.order_index, Beat.created_at)
    )
    return list(result.scalars().all())


async def update_beat(db: AsyncSession, beat: Beat, data: BeatUpdate) -> Beat:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(beat, field, value)
    await db.commit()
    await db.refresh(beat)
    return beat


async def delete_beat(db: AsyncSession, beat: Beat) -> None:
    await db.delete(beat)
    await db.commit()


async def reorder_beats(
    db: AsyncSession, scene_id: uuid.UUID, order: list[uuid.UUID]
) -> list[Beat]:
    beats = await list_beats(db, scene_id)
    beat_map = {b.id: b for b in beats}
    validate_permutation(order, set(beat_map), "beat")
    for idx, beat_id in enumerate(order):
        beat_map[beat_id].order_index = idx
    await db.commit()
    return await list_beats(db, scene_id)
