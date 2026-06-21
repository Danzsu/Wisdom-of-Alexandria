import uuid

from alexandria_core.models.chapter import Chapter
from alexandria_core.models.generation_job import GenerationJob, JobStatus, JobType
from alexandria_core.models.scene import Scene
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def get_job(db: AsyncSession, job_id: uuid.UUID) -> GenerationJob | None:
    return await db.get(GenerationJob, job_id)


async def create_index_job(db: AsyncSession, project_id: uuid.UUID) -> GenerationJob:
    """Create a PENDING project-scoped RAG index job and persist it.

    The async ``POST /ai/index/async`` endpoint creates this, then enqueues it
    for the RQ worker; the worker flips it to running/done/failed. Committed +
    refreshed so the caller gets a server-populated row (id, timestamps) to
    return and the worker can immediately load it by id.
    """
    job = GenerationJob(
        project_id=project_id,
        job_type=JobType.INDEX,
        status=JobStatus.PENDING,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


async def list_jobs(
    db: AsyncSession,
    scene_id: uuid.UUID | None = None,
    status: str | None = None,
    book_id: uuid.UUID | None = None,
    limit: int = 50,
) -> list[GenerationJob]:
    """List generation jobs, newest first, optionally scoped to a book.

    Filters:
      - ``scene_id`` / ``status``: direct column matches.
      - ``book_id``: a job belongs to a book when its ``scene_id``'s scene lives
        in a chapter of that book, OR its ``chapter_id`` is a chapter of that
        book. ``chapter_id`` is a plain column (no FK), so both paths are joined
        manually against ``Chapter`` / ``Scene`` (which the AI service shares via
        ``alexandria_core``). Jobs with neither a scene nor a chapter in the book
        are correctly excluded from a book-scoped query.
      - ``limit``: caps the number of rows returned (bounded by the endpoint).
    """
    query = select(GenerationJob)
    if scene_id is not None:
        query = query.where(GenerationJob.scene_id == scene_id)
    if status is not None:
        query = query.where(GenerationJob.status == status)
    if book_id is not None:
        # Scenes whose owning chapter belongs to the book.
        scene_ids_in_book = (
            select(Scene.id)
            .join(Chapter, Scene.chapter_id == Chapter.id)
            .where(Chapter.book_id == book_id)
        )
        # Chapters that belong to the book (matched against the plain
        # ``chapter_id`` column — there is no FK to join on).
        chapter_ids_in_book = select(Chapter.id).where(Chapter.book_id == book_id)
        query = query.where(
            GenerationJob.scene_id.in_(scene_ids_in_book)
            | GenerationJob.chapter_id.in_(chapter_ids_in_book)
        )
    query = query.order_by(GenerationJob.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return list(result.scalars().all())


async def delete_job(db: AsyncSession, job: GenerationJob) -> None:
    await db.delete(job)
    await db.commit()
