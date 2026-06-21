import uuid

from alexandria_core.models.book import Book
from alexandria_core.models.plotline import Plotline
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.book import BookCreate, BookUpdate
from app.services.crud_series import validate_series_in_project


async def create_book(db: AsyncSession, project_id: uuid.UUID, data: BookCreate) -> Book:
    # A book may only be attached to a series in its OWN project (else reject —
    # no silent cross-project leak). None = no series, always valid.
    await validate_series_in_project(db, project_id, data.series_id)
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
        select(Book)
        .where(Book.project_id == project_id)
        .order_by(Book.order_index, Book.created_at)
    )
    return list(result.scalars().all())


async def update_book(db: AsyncSession, book: Book, data: BookUpdate) -> Book:
    payload = data.model_dump(exclude_unset=True)
    # Only validate when series_id is actually being assigned (present in the
    # PATCH). Setting it to None (clearing) is valid; a real id must belong to
    # this book's project.
    if "series_id" in payload:
        await validate_series_in_project(db, book.project_id, payload["series_id"])
    for field, value in payload.items():
        setattr(book, field, value)
    await db.commit()
    await db.refresh(book)
    return book


async def delete_book(db: AsyncSession, book: Book) -> None:
    # A plotline scoped to this book must NOT be deleted with it — it falls back
    # to project-wide scope (book_id -> NULL). The DB-level FK is
    # ``ON DELETE SET NULL`` (authoritative on PostgreSQL), but we ALSO null the
    # reference explicitly here so the behaviour is deterministic and portable
    # regardless of whether the backend enforces FK ON DELETE actions (SQLite
    # does not unless ``PRAGMA foreign_keys`` is on). Plotlines are NEVER deleted
    # with the book — only detached.
    await db.execute(
        update(Plotline).where(Plotline.book_id == book.id).values(book_id=None)
    )
    await db.delete(book)
    await db.commit()
