import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.location import Location
from app.schemas.location import LocationCreate, LocationUpdate


async def create_location(
    db: AsyncSession, project_id: uuid.UUID, data: LocationCreate
) -> Location:
    location = Location(project_id=project_id, **data.model_dump())
    db.add(location)
    await db.commit()
    await db.refresh(location)
    return location


async def get_location(
    db: AsyncSession, project_id: uuid.UUID, location_id: uuid.UUID
) -> Location | None:
    result = await db.execute(
        select(Location).where(
            Location.id == location_id, Location.project_id == project_id
        )
    )
    return result.scalar_one_or_none()


async def list_locations(
    db: AsyncSession, project_id: uuid.UUID
) -> list[Location]:
    result = await db.execute(
        select(Location)
        .where(Location.project_id == project_id)
        .order_by(Location.name)
    )
    return list(result.scalars().all())


async def update_location(
    db: AsyncSession, location: Location, data: LocationUpdate
) -> Location:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(location, field, value)
    await db.commit()
    await db.refresh(location)
    return location


async def delete_location(db: AsyncSession, location: Location) -> None:
    await db.delete(location)
    await db.commit()
