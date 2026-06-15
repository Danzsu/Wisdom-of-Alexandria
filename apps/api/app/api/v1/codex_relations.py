import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.codex_relation import CodexRelationCreate, CodexRelationRead, CodexRelationUpdate
from app.services.crud_codex_relation import (
    create_codex_relation,
    delete_codex_relation,
    get_codex_relation,
    list_codex_relations,
    update_codex_relation,
)
from app.services.crud_project import get_project

router = APIRouter(prefix="/projects/{project_id}/codex-relations", tags=["codex_relations"])


async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession):
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.post("", response_model=CodexRelationRead, status_code=status.HTTP_201_CREATED)
async def create(
    project_id: uuid.UUID,
    data: CodexRelationCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CodexRelationRead:
    await _get_project_or_404(project_id, db)
    return await create_codex_relation(db, project_id, data)


@router.get("", response_model=list[CodexRelationRead])
async def list_all(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[CodexRelationRead]:
    await _get_project_or_404(project_id, db)
    return await list_codex_relations(db, project_id)


@router.get("/{relation_id}", response_model=CodexRelationRead)
async def get_one(
    project_id: uuid.UUID,
    relation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CodexRelationRead:
    await _get_project_or_404(project_id, db)
    relation = await get_codex_relation(db, project_id, relation_id)
    if relation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Codex relation not found"
        )
    return relation


@router.patch("/{relation_id}", response_model=CodexRelationRead)
async def update(
    project_id: uuid.UUID,
    relation_id: uuid.UUID,
    data: CodexRelationUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> CodexRelationRead:
    await _get_project_or_404(project_id, db)
    relation = await get_codex_relation(db, project_id, relation_id)
    if relation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Codex relation not found"
        )
    return await update_codex_relation(db, relation, data)


@router.delete("/{relation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    project_id: uuid.UUID,
    relation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    await _get_project_or_404(project_id, db)
    relation = await get_codex_relation(db, project_id, relation_id)
    if relation is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Codex relation not found"
        )
    await delete_codex_relation(db, relation)
