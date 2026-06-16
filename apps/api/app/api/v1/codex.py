import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.codex_entry import CodexEntryCreate, CodexEntryRead, CodexEntryUpdate
from app.services.crud_codex_entry import (
    create_codex_entry,
    delete_codex_entry,
    get_codex_entry,
    list_codex_entries,
    update_codex_entry,
)
from app.services.crud_project import get_project
from app.services.crud_series import SeriesScopeError

router = APIRouter(prefix="/projects/{project_id}/codex", tags=["codex"])


async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession):
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.post("", response_model=CodexEntryRead, status_code=status.HTTP_201_CREATED)
async def create(
    project_id: uuid.UUID,
    data: CodexEntryCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CodexEntryRead:
    await _get_project_or_404(project_id, db)
    try:
        return await create_codex_entry(db, project_id, data)
    except SeriesScopeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.get("", response_model=list[CodexEntryRead])
async def list_all(
    project_id: uuid.UUID,
    series_id: uuid.UUID | None = Query(
        None,
        description=(
            "Optional series scope filter. When given, returns project-global "
            "entries (series_id IS NULL) PLUS entries scoped to this series, and "
            "EXCLUDES entries scoped to any other series. Omit to return all "
            "entries in the project."
        ),
    ),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[CodexEntryRead]:
    await _get_project_or_404(project_id, db)
    return await list_codex_entries(db, project_id, series_id)


@router.get("/{entry_id}", response_model=CodexEntryRead)
async def get_one(
    project_id: uuid.UUID,
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CodexEntryRead:
    await _get_project_or_404(project_id, db)
    entry = await get_codex_entry(db, project_id, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Codex entry not found")
    return entry


@router.patch("/{entry_id}", response_model=CodexEntryRead)
async def update(
    project_id: uuid.UUID,
    entry_id: uuid.UUID,
    data: CodexEntryUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CodexEntryRead:
    await _get_project_or_404(project_id, db)
    entry = await get_codex_entry(db, project_id, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Codex entry not found")
    try:
        return await update_codex_entry(db, entry, data)
    except SeriesScopeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    project_id: uuid.UUID,
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    await _get_project_or_404(project_id, db)
    entry = await get_codex_entry(db, project_id, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Codex entry not found")
    await delete_codex_entry(db, entry)
