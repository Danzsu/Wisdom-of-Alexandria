import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.style_guide import StyleGuide
from app.schemas.style_guide import StyleGuideCreate, StyleGuideUpdate


async def get_style_guide(
    db: AsyncSession, project_id: uuid.UUID
) -> StyleGuide | None:
    result = await db.execute(
        select(StyleGuide).where(StyleGuide.project_id == project_id)
    )
    return result.scalar_one_or_none()


async def create_style_guide(
    db: AsyncSession, project_id: uuid.UUID, data: StyleGuideCreate
) -> StyleGuide:
    style_guide = StyleGuide(project_id=project_id, **data.model_dump())
    db.add(style_guide)
    await db.commit()
    await db.refresh(style_guide)
    return style_guide


async def upsert_style_guide(
    db: AsyncSession, project_id: uuid.UUID, data: StyleGuideCreate
) -> tuple[StyleGuide, bool]:
    """Returns (style_guide, created: bool).

    If exists, replace all fields. If not, create.
    """
    existing = await get_style_guide(db, project_id)
    if existing is None:
        style_guide = await create_style_guide(db, project_id, data)
        return style_guide, True

    # Replace all fields (full replace, not partial)
    for field, value in data.model_dump().items():
        setattr(existing, field, value)
    await db.commit()
    await db.refresh(existing)
    return existing, False


async def update_style_guide(
    db: AsyncSession, style_guide: StyleGuide, data: StyleGuideUpdate
) -> StyleGuide:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(style_guide, field, value)
    await db.commit()
    await db.refresh(style_guide)
    return style_guide


async def delete_style_guide(db: AsyncSession, style_guide: StyleGuide) -> None:
    await db.delete(style_guide)
    await db.commit()
