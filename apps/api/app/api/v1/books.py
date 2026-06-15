import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.book import BookCreate, BookRead, BookUpdate
from app.services.crud_book import create_book, delete_book, get_book, list_books, update_book
from app.services.crud_project import get_project

router = APIRouter(prefix="/projects/{project_id}/books", tags=["books"])


async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession):
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.post("", response_model=BookRead, status_code=status.HTTP_201_CREATED)
async def create(
    project_id: uuid.UUID,
    data: BookCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> BookRead:
    await _get_project_or_404(project_id, db)
    return await create_book(db, project_id, data)


@router.get("", response_model=list[BookRead])
async def list_all(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[BookRead]:
    await _get_project_or_404(project_id, db)
    return await list_books(db, project_id)


@router.get("/{book_id}", response_model=BookRead)
async def get_one(
    project_id: uuid.UUID,
    book_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> BookRead:
    await _get_project_or_404(project_id, db)
    book = await get_book(db, project_id, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    return book


@router.patch("/{book_id}", response_model=BookRead)
async def update(
    project_id: uuid.UUID,
    book_id: uuid.UUID,
    data: BookUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> BookRead:
    await _get_project_or_404(project_id, db)
    book = await get_book(db, project_id, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    return await update_book(db, book, data)


@router.delete("/{book_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    project_id: uuid.UUID,
    book_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    await _get_project_or_404(project_id, db)
    book = await get_book(db, project_id, book_id)
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    await delete_book(db, book)
