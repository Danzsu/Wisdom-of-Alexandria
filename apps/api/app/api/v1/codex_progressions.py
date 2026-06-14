import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.codex_progression import (
    CodexProgressionCreate,
    CodexProgressionRead,
    CodexProgressionUpdate,
)
from app.services.crud_codex_progression import (
    create_codex_progression,
    delete_codex_progression,
    get_codex_progression,
    list_codex_progressions,
    update_codex_progression,
)

router = APIRouter(prefix="/codex-progressions", tags=["codex_progressions"])


@router.post("", response_model=CodexProgressionRead, status_code=status.HTTP_201_CREATED)
async def create(
    data: CodexProgressionCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CodexProgressionRead:
    return await create_codex_progression(db, data)


@router.get("", response_model=list[CodexProgressionRead])
async def list_all(
    entity_type: str = Query(...),
    entity_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[CodexProgressionRead]:
    return await list_codex_progressions(db, entity_type, entity_id)


@router.get("/{progression_id}", response_model=CodexProgressionRead)
async def get_one(
    progression_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CodexProgressionRead:
    progression = await get_codex_progression(db, progression_id)
    if progression is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Codex progression not found"
        )
    return progression


@router.patch("/{progression_id}", response_model=CodexProgressionRead)
async def update(
    progression_id: uuid.UUID,
    data: CodexProgressionUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CodexProgressionRead:
    progression = await get_codex_progression(db, progression_id)
    if progression is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Codex progression not found"
        )
    return await update_codex_progression(db, progression, data)


@router.delete("/{progression_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    progression_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    progression = await get_codex_progression(db, progression_id)
    if progression is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Codex progression not found"
        )
    await delete_codex_progression(db, progression)
