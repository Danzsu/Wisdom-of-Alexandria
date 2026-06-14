import uuid
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.codex_progression import CodexProgression
from app.schemas.codex_progression import CodexProgressionCreate, CodexProgressionUpdate


async def create_codex_progression(
    db: AsyncSession, data: CodexProgressionCreate
) -> CodexProgression:
    progression = CodexProgression(**data.model_dump())
    db.add(progression)
    await db.commit()
    await db.refresh(progression)
    return progression


async def get_codex_progression(
    db: AsyncSession, progression_id: uuid.UUID
) -> CodexProgression | None:
    result = await db.execute(select(CodexProgression).where(CodexProgression.id == progression_id))
    return result.scalar_one_or_none()


async def list_codex_progressions(
    db: AsyncSession, entity_type: str, entity_id: uuid.UUID
) -> list[CodexProgression]:
    result = await db.execute(
        select(CodexProgression)
        .where(
            and_(
                CodexProgression.entity_type == entity_type,
                CodexProgression.entity_id == entity_id,
            )
        )
        .order_by(CodexProgression.created_at.desc())
    )
    return list(result.scalars().all())


async def update_codex_progression(
    db: AsyncSession, progression: CodexProgression, data: CodexProgressionUpdate
) -> CodexProgression:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(progression, field, value)
    await db.commit()
    await db.refresh(progression)
    return progression


async def delete_codex_progression(db: AsyncSession, progression: CodexProgression) -> None:
    await db.delete(progression)
    await db.commit()
