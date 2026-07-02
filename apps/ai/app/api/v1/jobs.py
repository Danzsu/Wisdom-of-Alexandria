import uuid

from alexandria_core.core.deps import get_current_user, get_db
from alexandria_core.models.generation_job import (
    TERMINAL_JOB_STATUSES,
    JobStatus,
)
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.generation_job import GenerationJobRead
from app.services.crud_generation_job import delete_job, get_job, list_jobs
from app.services.job_queue import cancel_rq_job

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[GenerationJobRead])
async def list_all(
    scene_id: uuid.UUID | None = Query(default=None),
    status: str | None = Query(default=None),
    book_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[GenerationJobRead]:
    return await list_jobs(
        db, scene_id=scene_id, status=status, book_id=book_id, limit=limit
    )


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


@router.post("/{job_id}/cancel", response_model=GenerationJobRead)
async def cancel(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> GenerationJobRead:
    """Cancel a generation job.

    PENDING → best-effort dequeue of the RQ job (its id equals this uuid — see
    ``job_queue``) and the row flips to ``cancelled``. RUNNING → cooperative:
    only the flag is set; the worker checks it and stops cleanly. A job already
    in a terminal state (done/failed/cancelled) → 409.

    Cooperative-cancel semantics per job type (ALL types check at ENTRY: an
    already-cancelled row is never started, never flipped to RUNNING):
      - ``chapter_generate``: additionally checked BETWEEN scenes — the loop
        stops before the next scene, KEEPING the already-generated revisions; a
        cancel landing during the last scene is still honoured (the final DONE
        write re-checks).
      - ``index`` / ``image``: the work phase is one monolithic call, so mid-work
        interruption is not possible — instead the worker re-checks BEFORE the
        terminal DONE/FAILED write (a mid-work cancel is never stomped by
        DONE/FAILED).

    NOTE: ``DELETE /jobs/{id}`` only removes the DB row and never touches RQ —
    this endpoint is the one that actually stops work.
    """
    job = await get_job(db, job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Job not found"
        )
    if job.status in TERMINAL_JOB_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job is already {job.status} and cannot be cancelled",
        )
    if job.status == JobStatus.PENDING:
        # Best-effort: a False result (already dequeued / Redis down) must not
        # block cancellation — the worker no-ops on a cancelled row.
        cancel_rq_job(job.id)
    job.status = JobStatus.CANCELLED
    await db.commit()
    await db.refresh(job)
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
