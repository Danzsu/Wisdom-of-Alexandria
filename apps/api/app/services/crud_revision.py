import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.text import count_words
from app.models.revision import Revision
from app.models.scene import Scene


async def get_revision(db: AsyncSession, revision_id: uuid.UUID) -> Revision | None:
    return await db.get(Revision, revision_id)


async def list_revisions_for_scene(
    db: AsyncSession, scene_id: uuid.UUID
) -> list[Revision]:
    query = (
        select(Revision)
        .where(Revision.scene_id == scene_id)
        .order_by(Revision.created_at.desc())
    )
    result = await db.execute(query)
    return list(result.scalars().all())


async def approve_revision(db: AsyncSession, revision: Revision) -> Revision:
    revision.approved = True
    if revision.scene_id is not None:
        scene = await db.get(Scene, revision.scene_id)
        if scene is not None:
            scene.content = revision.content
            scene.word_count = count_words(revision.content)
    await db.commit()
    await db.refresh(revision)
    return revision


async def reject_revision(db: AsyncSession, revision: Revision) -> Revision:
    revision.approved = False
    await db.commit()
    await db.refresh(revision)
    return revision
