import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.snippet import SnippetCreate, SnippetRead, SnippetUpdate
from app.services.crud_snippet import (
    create_snippet,
    delete_snippet,
    get_snippet,
    list_snippets,
    update_snippet,
)
from app.services.crud_project import get_project

router = APIRouter(prefix="/projects/{project_id}/snippets", tags=["snippets"])


async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession):
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.post("", response_model=SnippetRead, status_code=status.HTTP_201_CREATED)
async def create(
    project_id: uuid.UUID,
    data: SnippetCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SnippetRead:
    await _get_project_or_404(project_id, db)
    return await create_snippet(db, project_id, data)


@router.get("", response_model=list[SnippetRead])
async def list_all(
    project_id: uuid.UUID,
    tag: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[SnippetRead]:
    await _get_project_or_404(project_id, db)
    return await list_snippets(db, project_id, tag=tag)


@router.get("/{snippet_id}", response_model=SnippetRead)
async def get_one(
    project_id: uuid.UUID,
    snippet_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SnippetRead:
    await _get_project_or_404(project_id, db)
    snippet = await get_snippet(db, project_id, snippet_id)
    if snippet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snippet not found")
    return snippet


@router.patch("/{snippet_id}", response_model=SnippetRead)
async def update(
    project_id: uuid.UUID,
    snippet_id: uuid.UUID,
    data: SnippetUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> SnippetRead:
    await _get_project_or_404(project_id, db)
    snippet = await get_snippet(db, project_id, snippet_id)
    if snippet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snippet not found")
    return await update_snippet(db, snippet, data)


@router.delete("/{snippet_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    project_id: uuid.UUID,
    snippet_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    await _get_project_or_404(project_id, db)
    snippet = await get_snippet(db, project_id, snippet_id)
    if snippet is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snippet not found")
    await delete_snippet(db, snippet)
