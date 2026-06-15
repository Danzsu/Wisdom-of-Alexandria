import uuid

from alexandria_core.models.generation_job import GenerationJob
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def get_job(db: AsyncSession, job_id: uuid.UUID) -> GenerationJob | None:
    return await db.get(GenerationJob, job_id)


async def list_jobs(
    db: AsyncSession,
    scene_id: uuid.UUID | None = None,
    status: str | None = None,
) -> list[GenerationJob]:
    query = select(GenerationJob)
    if scene_id is not None:
        query = query.where(GenerationJob.scene_id == scene_id)
    if status is not None:
        query = query.where(GenerationJob.status == status)
    query = query.order_by(GenerationJob.created_at.desc())
    result = await db.execute(query)
    return list(result.scalars().all())


async def delete_job(db: AsyncSession, job: GenerationJob) -> None:
    await db.delete(job)
    await db.commit()
