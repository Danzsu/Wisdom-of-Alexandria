import uuid

from alexandria_core.models.book import Book
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.book import BookCreate, BookUpdate


async def create_book(db: AsyncSession, project_id: uuid.UUID, data: BookCreate) -> Book:
    book = Book(project_id=project_id, **data.model_dump())
    db.add(book)
    await db.commit()
    await db.refresh(book)
    return book


async def get_book(db: AsyncSession, project_id: uuid.UUID, book_id: uuid.UUID) -> Book | None:
    result = await db.execute(
        select(Book).where(Book.id == book_id, Book.project_id == project_id)
    )
    return result.scalar_one_or_none()


async def list_books(db: AsyncSession, project_id: uuid.UUID) -> list[Book]:
    result = await db.execute(
        select(Book).where(Book.project_id == project_id).order_by(Book.order_index, Book.created_at)
    )
    return list(result.scalars().all())


async def update_book(db: AsyncSession, book: Book, data: BookUpdate) -> Book:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(book, field, value)
    await db.commit()
    await db.refresh(book)
    return book


async def delete_book(db: AsyncSession, book: Book) -> None:
    await db.delete(book)
    await db.commit()
