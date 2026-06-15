import uuid
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import safe_error
from app.models.generation_job import GenerationJob, JobStatus
from app.models.revision import Revision


class RevisionService:
    """Manages AI output persistence as Revision records.

    Invariant: AI output always creates a Revision — never directly overwrites scene content.
    Human approval step (POST /revisions/{id}/approve) is required to apply.
    """

    async def save_revision(
        self,
        db: AsyncSession,
        *,
        content: str,
        revision_type: str,
        scene_id: uuid.UUID | None = None,
        job_id: uuid.UUID | None = None,
        model_name: str | None = None,
        prompt_version: str | None = None,
    ) -> Revision:
        revision = Revision(
            scene_id=scene_id,
            job_id=job_id,
            content=content,
            approved=False,
            revision_type=revision_type,
            model_name=model_name,
            prompt_version=prompt_version,
        )
        db.add(revision)
        await db.commit()
        await db.refresh(revision)
        return revision

    async def create_job(
        self,
        db: AsyncSession,
        *,
        job_type: str,
        scene_id: uuid.UUID | None = None,
        chapter_id: uuid.UUID | None = None,
        model_name: str | None = None,
        prompt_version: str | None = None,
        input_data: dict | None = None,
    ) -> GenerationJob:
        job = GenerationJob(
            job_type=job_type,
            scene_id=scene_id,
            chapter_id=chapter_id,
            status=JobStatus.RUNNING,
            model_name=model_name,
            prompt_version=prompt_version,
            input_data=input_data,
        )
        db.add(job)
        await db.commit()
        await db.refresh(job)
        return job

    async def complete_job(
        self,
        db: AsyncSession,
        job: GenerationJob,
        output_data: dict,
    ) -> GenerationJob:
        job.status = JobStatus.DONE
        job.output_data = output_data
        await db.commit()
        await db.refresh(job)
        return job

    async def fail_job(
        self,
        db: AsyncSession,
        job: GenerationJob,
        error_message: str,
    ) -> GenerationJob:
        job.status = JobStatus.FAILED
        # GET /jobs/{id} returns error_message, so bound + single-line it to
        # avoid persisting (and later leaking) unbounded raw internal text.
        # Idempotent if the caller already sanitized.
        job.error_message = safe_error(error_message)
        await db.commit()
        await db.refresh(job)
        return job


revision_service = RevisionService()
