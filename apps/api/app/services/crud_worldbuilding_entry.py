import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.worldbuilding_entry import WorldbuildingEntry
from app.schemas.worldbuilding_entry import WorldbuildingEntryCreate, WorldbuildingEntryUpdate


async def create_worldbuilding_entry(
    db: AsyncSession, project_id: uuid.UUID, data: WorldbuildingEntryCreate
) -> WorldbuildingEntry:
    entry = WorldbuildingEntry(project_id=project_id, **data.model_dump())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def get_worldbuilding_entry(
    db: AsyncSession, project_id: uuid.UUID, entry_id: uuid.UUID
) -> WorldbuildingEntry | None:
    result = await db.execute(
        select(WorldbuildingEntry).where(
            WorldbuildingEntry.id == entry_id,
            WorldbuildingEntry.project_id == project_id,
        )
    )
    return result.scalar_one_or_none()


async def list_worldbuilding_entries(
    db: AsyncSession, project_id: uuid.UUID
) -> list[WorldbuildingEntry]:
    result = await db.execute(
        select(WorldbuildingEntry)
        .where(WorldbuildingEntry.project_id == project_id)
        .order_by(WorldbuildingEntry.name)
    )
    return list(result.scalars().all())


async def update_worldbuilding_entry(
    db: AsyncSession, entry: WorldbuildingEntry, data: WorldbuildingEntryUpdate
) -> WorldbuildingEntry:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    await db.commit()
    await db.refresh(entry)
    return entry


async def delete_worldbuilding_entry(
    db: AsyncSession, entry: WorldbuildingEntry
) -> None:
    await db.delete(entry)
    await db.commit()
