import uuid

from alexandria_core.models.chapter import Chapter
from alexandria_core.models.generation_job import GenerationJob
from alexandria_core.models.revision import Revision
from alexandria_core.models.scene import Scene
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.text import count_words


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
    if revision.revision_type == "summarize":
        # A summary must NEVER overwrite the manuscript text. Route it to the
        # SUMMARY field of whatever it resolves to:
        #   - scene summary  → revision.scene_id (set when summarizing a scene)
        #   - chapter summary → the linked job's chapter_id (a chapter summarize
        #     leaves scene_id None and carries the target chapter on the job)
        # scene.content is left untouched in both branches.
        await _apply_summary(db, revision)
    elif revision.scene_id is not None:
        # Non-summary content revisions overwrite the scene text as before.
        scene = await db.get(Scene, revision.scene_id)
        if scene is not None:
            scene.content = revision.content
            scene.word_count = count_words(revision.content)
    await db.commit()
    await db.refresh(revision)
    return revision


async def _apply_summary(db: AsyncSession, revision: Revision) -> None:
    """Persist a summarize revision to the correct ``summary`` field.

    Scene summary takes precedence (a scene-scoped summarize has scene_id).
    Otherwise, if the revision's job targets a chapter, set the chapter summary.
    Both lookups guard None so a dangling/SET NULL FK never raises here.
    """
    if revision.scene_id is not None:
        scene = await db.get(Scene, revision.scene_id)
        if scene is not None:
            scene.summary = revision.content
        return
    if revision.job_id is not None:
        job = await db.get(GenerationJob, revision.job_id)
        if job is not None and job.chapter_id is not None:
            chapter = await db.get(Chapter, job.chapter_id)
            if chapter is not None:
                chapter.summary = revision.content


async def reject_revision(db: AsyncSession, revision: Revision) -> Revision:
    revision.approved = False
    await db.commit()
    await db.refresh(revision)
    return revision
