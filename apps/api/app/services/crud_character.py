import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.character import Character
from app.schemas.character import CharacterCreate, CharacterUpdate


async def create_character(
    db: AsyncSession, project_id: uuid.UUID, data: CharacterCreate
) -> Character:
    character = Character(project_id=project_id, **data.model_dump())
    db.add(character)
    await db.commit()
    await db.refresh(character)
    return character


async def get_character(
    db: AsyncSession, project_id: uuid.UUID, char_id: uuid.UUID
) -> Character | None:
    result = await db.execute(
        select(Character).where(
            Character.id == char_id, Character.project_id == project_id
        )
    )
    return result.scalar_one_or_none()


async def list_characters(
    db: AsyncSession, project_id: uuid.UUID
) -> list[Character]:
    result = await db.execute(
        select(Character)
        .where(Character.project_id == project_id)
        .order_by(Character.name)
    )
    return list(result.scalars().all())


async def update_character(
    db: AsyncSession, character: Character, data: CharacterUpdate
) -> Character:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(character, field, value)
    await db.commit()
    await db.refresh(character)
    return character


async def delete_character(db: AsyncSession, character: Character) -> None:
    await db.delete(character)
    await db.commit()
