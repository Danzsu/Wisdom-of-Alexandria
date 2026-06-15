import uuid

from alexandria_core.core.deps import get_current_user, get_db
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.generation_job import GenerationJobRead
from app.services.crud_generation_job import delete_job, get_job, list_jobs

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[GenerationJobRead])
async def list_all(
    scene_id: uuid.UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[GenerationJobRead]:
    return await list_jobs(db, scene_id=scene_id, status=status)


@router.get("/{job_id}", response_model=GenerationJobRead)
async def get_one(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> GenerationJobRead:
    job = await get_job(db, job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job not found"
        )
    return job


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    job = await get_job(db, job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job not found"
        )
    await delete_job(db, job)
