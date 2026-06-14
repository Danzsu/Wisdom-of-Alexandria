import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.codex_relation import CodexRelation
from app.schemas.codex_relation import CodexRelationCreate, CodexRelationUpdate


async def create_codex_relation(
    db: AsyncSession, project_id: uuid.UUID, data: CodexRelationCreate
) -> CodexRelation:
    relation = CodexRelation(project_id=project_id, **data.model_dump())
    db.add(relation)
    await db.commit()
    await db.refresh(relation)
    return relation


async def get_codex_relation(
    db: AsyncSession, project_id: uuid.UUID, relation_id: uuid.UUID
) -> CodexRelation | None:
    result = await db.execute(
        select(CodexRelation).where(
            CodexRelation.id == relation_id, CodexRelation.project_id == project_id
        )
    )
    return result.scalar_one_or_none()


async def list_codex_relations(
    db: AsyncSession, project_id: uuid.UUID
) -> list[CodexRelation]:
    result = await db.execute(
        select(CodexRelation)
        .where(CodexRelation.project_id == project_id)
        .order_by(CodexRelation.created_at.desc())
    )
    return list(result.scalars().all())


async def update_codex_relation(
    db: AsyncSession, relation: CodexRelation, data: CodexRelationUpdate
) -> CodexRelation:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(relation, field, value)
    await db.commit()
    await db.refresh(relation)
    return relation


async def delete_codex_relation(db: AsyncSession, relation: CodexRelation) -> None:
    await db.delete(relation)
    await db.commit()
