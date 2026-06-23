"""Book cover generation HTTP layer (Phase 2).

POST /ai/covers enqueues a cover job (a MediaAsset with entity_type="cover").
Validation 422s are raised BEFORE any create and OUTSIDE the try, so they are
never re-wrapped into the enqueue 502. List/canonical/delete/serve reuse the
Phase-1 /ai/images + /ai/media endpoints (entity_type="cover").
"""
import logging

from alexandria_core.core.deps import get_current_user, get_db
from alexandria_core.core.errors import safe_error
from alexandria_core.models.book import Book
from alexandria_core.models.generation_job import GenerationJob, JobStatus, JobType
from alexandria_core.models.media_asset import MediaAsset
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.images import _resolve_image_model
from app.schemas.cover import CoverGenerateRequest, CoverLayoutInfo
from app.schemas.media_asset import ImageStyleInfo, MediaAssetRead
from app.services.cover_compositor import available_cover_layouts
from app.services.image_prompt import available_cover_styles
from app.services.job_queue import enqueue_image_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["covers"])


@router.post("/covers", response_model=MediaAssetRead, status_code=status.HTTP_202_ACCEPTED)
async def generate_cover(
    data: CoverGenerateRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> MediaAssetRead:
    """Enqueue a cover-generation job for a Book.

    Creates a ``generating`` MediaAsset + an IMAGE GenerationJob, hands the job
    id to the worker queue, and returns the asset (202). All validation (art_style,
    layout, book existence, model availability) happens BEFORE anything is created
    and OUTSIDE the try, so a 422 is never re-wrapped into a 502.
    """
    # ── Validation (all 422s, BEFORE any create, OUTSIDE the try) ──────────────
    if data.art_style not in {s.slug for s in available_cover_styles()}:
        raise HTTPException(status_code=422, detail="invalid cover art_style")

    if data.layout not in {lay.slug for lay in available_cover_layouts()}:
        raise HTTPException(status_code=422, detail="invalid cover layout")

    book = await db.get(Book, data.book_id)
    if book is None:
        raise HTTPException(status_code=422, detail="book_id does not exist")

    model = data.model or await _resolve_image_model(db)
    if model is None:
        raise HTTPException(status_code=422, detail="no image model configured")

    title = (data.title or book.title or "").strip()
    author = (data.author if data.author is not None else (book.author or "")).strip()

    # ── Create + enqueue ──────────────────────────────────────────────────────
    asset = MediaAsset(
        status="generating",
        project_id=book.project_id,
        entity_type="cover",
        entity_id=book.id,
        style=data.art_style,
        model_name=model,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    job = GenerationJob(
        job_type=JobType.IMAGE,
        project_id=book.project_id,
        status=JobStatus.PENDING,
        model_name=model,
        input_data={
            "entity_type": "cover",
            "entity_id": str(book.id),
            "art_style": data.art_style,
            "layout": data.layout,
            "title": title,
            "author": author,
            "subtitle": data.subtitle,
            "model": model,
            "asset_id": str(asset.id),
        },
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    asset.job_id = job.id
    await db.commit()
    await db.refresh(asset)

    try:
        enqueue_image_job(job.id)
    except Exception as exc:
        # The rows exist but could not be queued (e.g. Redis unreachable). Mark
        # BOTH failed so neither dangles. The 502 detail is a FIXED message — the
        # enqueue exception can carry the broker URL + credentials and safe_error
        # only bounds (does not strip secrets) — so it is never echoed; the cause
        # is logged server-side (sanitized).
        logger.warning("Cover job enqueue failed: %s", safe_error(exc))
        job.status = JobStatus.FAILED
        job.error_message = "A feladat sorba állítása nem sikerült."
        asset.status = "failed"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not enqueue cover job (queue unavailable).",
        )

    return MediaAssetRead.model_validate(asset)


@router.get("/covers/styles", response_model=list[ImageStyleInfo])
async def list_cover_styles(
    _: str = Depends(get_current_user),
) -> list[ImageStyleInfo]:
    """List the available cover art-style presets."""
    return [
        ImageStyleInfo(slug=s.slug, label=s.label, entity_type=s.entity_type)
        for s in available_cover_styles()
    ]


@router.get("/covers/layouts", response_model=list[CoverLayoutInfo])
async def list_cover_layouts(
    _: str = Depends(get_current_user),
) -> list[CoverLayoutInfo]:
    """List the available cover typography layouts."""
    return [
        CoverLayoutInfo(slug=lay.slug, label=lay.label)
        for lay in available_cover_layouts()
    ]
