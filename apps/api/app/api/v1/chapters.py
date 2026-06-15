import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.book import Book
from app.schemas.chapter import ChapterCreate, ChapterRead, ChapterReorder, ChapterUpdate
from app.services.crud_chapter import (
    create_chapter,
    delete_chapter,
    get_chapter,
    list_chapters,
    reorder_chapters,
    update_chapter,
)

router = APIRouter(prefix="/books/{book_id}/chapters", tags=["chapters"])


async def _get_book_or_404(book_id: uuid.UUID, db: AsyncSession):
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    return book


@router.post("", response_model=ChapterRead, status_code=status.HTTP_201_CREATED)
async def create(
    book_id: uuid.UUID,
    data: ChapterCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ChapterRead:
    await _get_book_or_404(book_id, db)
    return await create_chapter(db, book_id, data)


@router.get("", response_model=list[ChapterRead])
async def list_all(
    book_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[ChapterRead]:
    await _get_book_or_404(book_id, db)
    return await list_chapters(db, book_id)


@router.post("/reorder", response_model=list[ChapterRead])
async def reorder(
    book_id: uuid.UUID,
    data: ChapterReorder,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[ChapterRead]:
    await _get_book_or_404(book_id, db)
    try:
        return await reorder_chapters(db, book_id, data.order)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{chapter_id}", response_model=ChapterRead)
async def get_one(
    book_id: uuid.UUID,
    chapter_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ChapterRead:
    await _get_book_or_404(book_id, db)
    chapter = await get_chapter(db, book_id, chapter_id)
    if chapter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    return chapter


@router.patch("/{chapter_id}", response_model=ChapterRead)
async def update(
    book_id: uuid.UUID,
    chapter_id: uuid.UUID,
    data: ChapterUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ChapterRead:
    await _get_book_or_404(book_id, db)
    chapter = await get_chapter(db, book_id, chapter_id)
    if chapter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    return await update_chapter(db, chapter, data)


@router.delete("/{chapter_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    book_id: uuid.UUID,
    chapter_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    await _get_book_or_404(book_id, db)
    chapter = await get_chapter(db, book_id, chapter_id)
    if chapter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    await delete_chapter(db, chapter)
