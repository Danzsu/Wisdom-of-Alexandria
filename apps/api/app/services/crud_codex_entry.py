import uuid

from alexandria_core.models.codex_entry import CodexEntry
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.codex_entry import CodexEntryCreate, CodexEntryUpdate


async def create_codex_entry(
    db: AsyncSession, project_id: uuid.UUID, data: CodexEntryCreate
) -> CodexEntry:
    entry = CodexEntry(project_id=project_id, **data.model_dump())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def get_codex_entry(
    db: AsyncSession, project_id: uuid.UUID, entry_id: uuid.UUID
) -> CodexEntry | None:
    result = await db.execute(
        select(CodexEntry).where(
            CodexEntry.id == entry_id,
            CodexEntry.project_id == project_id,
        )
    )
    return result.scalar_one_or_none()


async def list_codex_entries(
    db: AsyncSession, project_id: uuid.UUID
) -> list[CodexEntry]:
    result = await db.execute(
        select(CodexEntry)
        .where(CodexEntry.project_id == project_id)
        .order_by(CodexEntry.title)
    )
    return list(result.scalars().all())


async def update_codex_entry(
    db: AsyncSession, entry: CodexEntry, data: CodexEntryUpdate
) -> CodexEntry:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    await db.commit()
    await db.refresh(entry)
    return entry


async def delete_codex_entry(db: AsyncSession, entry: CodexEntry) -> None:
    await db.delete(entry)
    await db.commit()
