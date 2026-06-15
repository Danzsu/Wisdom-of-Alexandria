import uuid

from alexandria_core.models.chapter import Chapter
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.chapter import ChapterCreate, ChapterUpdate
from app.services.ordering import validate_permutation


async def create_chapter(db: AsyncSession, book_id: uuid.UUID, data: ChapterCreate) -> Chapter:
    chapter = Chapter(book_id=book_id, **data.model_dump())
    db.add(chapter)
    await db.commit()
    await db.refresh(chapter)
    return chapter


async def get_chapter(db: AsyncSession, book_id: uuid.UUID, chapter_id: uuid.UUID) -> Chapter | None:
    result = await db.execute(
        select(Chapter).where(Chapter.id == chapter_id, Chapter.book_id == book_id)
    )
    return result.scalar_one_or_none()


async def list_chapters(db: AsyncSession, book_id: uuid.UUID) -> list[Chapter]:
    result = await db.execute(
        select(Chapter).where(Chapter.book_id == book_id).order_by(Chapter.order_index, Chapter.created_at)
    )
    return list(result.scalars().all())


async def update_chapter(db: AsyncSession, chapter: Chapter, data: ChapterUpdate) -> Chapter:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(chapter, field, value)
    await db.commit()
    await db.refresh(chapter)
    return chapter


async def delete_chapter(db: AsyncSession, chapter: Chapter) -> None:
    await db.delete(chapter)
    await db.commit()


async def reorder_chapters(db: AsyncSession, book_id: uuid.UUID, order: list[uuid.UUID]) -> list[Chapter]:
    chapters = await list_chapters(db, book_id)
    chapter_map = {c.id: c for c in chapters}
    validate_permutation(order, set(chapter_map), "chapter")
    for idx, chapter_id in enumerate(order):
        chapter_map[chapter_id].order_index = idx
    await db.commit()
    return await list_chapters(db, book_id)
