"""AI image-generation HTTP layer (Phase 1).

Endpoints to enqueue an image-gen job, list an entity's images, approve one as
canonical, delete one, list style presets, and SERVE the image binary. The async
machinery (RQ job, ImageService, MediaAsset) lives elsewhere; this module owns
the HTTP contract: auth, validation (a 422 raised BEFORE anything is created, and
OUTSIDE the try so it is never re-wrapped into a 502), a sanitized 502 on enqueue
failure (with the job + asset marked failed so neither dangles), and the
traversal-safe ``/media`` file server.
"""

import logging
import os
import uuid

from alexandria_core.core.config import settings
from alexandria_core.core.deps import get_current_user, get_db
from alexandria_core.core.errors import safe_error
from alexandria_core.models.generation_job import GenerationJob, JobStatus, JobType
from alexandria_core.models.media_asset import MediaAsset
from alexandria_core.models.project import Project
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.media_asset import (
    ImageGenerateRequest,
    ImageStyleInfo,
    MediaAssetRead,
)
from app.services.crud_provider import list_providers
from app.services.image_prompt import available_styles
from app.services.image_service import image_service
from app.services.job_queue import enqueue_image_job

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["images"])

_ALLOWED_ENTITY_TYPES = {"character", "location"}


async def _resolve_image_model(db: AsyncSession) -> str | None:
    """Return the first enabled provider's non-null ``image_model``, else None.

    Image generation is OPTIONAL (no provider need declare an image model);
    callers turn a ``None`` here + no explicit model into a 422.
    """
    for provider in await list_providers(db, enabled_only=True):
        if provider.image_model:
            return provider.image_model
    return None


@router.post(
    "/images",
    response_model=MediaAssetRead,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_image(
    data: ImageGenerateRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> MediaAssetRead:
    """Enqueue an image-generation job for a Codex Character/Location.

    Creates a ``generating`` MediaAsset + an IMAGE GenerationJob, hands the job
    id to the worker queue, and returns the asset (202). Poll ``GET /jobs/{id}``
    (the worker flips the asset to ready/failed). All validation (entity_type,
    style, project existence, model availability) happens BEFORE anything is
    created and OUTSIDE the try, so a 422 is never re-wrapped into a 502.
    """
    # ── Validation (all 422s, BEFORE any create, OUTSIDE the try) ──────────────
    if data.entity_type not in _ALLOWED_ENTITY_TYPES:
        raise HTTPException(
            status_code=422,
            detail=f"entity_type must be one of {sorted(_ALLOWED_ENTITY_TYPES)}",
        )

    valid_slugs = {s.slug for s in available_styles(data.entity_type)}
    if data.style not in valid_slugs:
        raise HTTPException(
            status_code=422,
            detail=f"invalid style for {data.entity_type}",
        )

    # Validate the project exists BEFORE creating anything — otherwise a bogus id
    # would FK-violate on insert (opaque 500 on PostgreSQL) or silently persist an
    # orphan (SQLite, FKs off). Done OUTSIDE the try so this 422 is not re-wrapped.
    if await db.get(Project, data.project_id) is None:
        raise HTTPException(status_code=422, detail="project_id does not exist")

    model = data.model or await _resolve_image_model(db)
    if model is None:
        raise HTTPException(status_code=422, detail="no image model configured")

    # ── Create + enqueue ──────────────────────────────────────────────────────
    asset = MediaAsset(
        status="generating",
        project_id=data.project_id,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        style=data.style,
        model_name=model,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    job = GenerationJob(
        job_type=JobType.IMAGE,
        project_id=data.project_id,
        status=JobStatus.PENDING,
        model_name=model,
        input_data={
            "entity_type": data.entity_type,
            "entity_id": str(data.entity_id),
            "style": data.style,
            "model": model,
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
    except Exception as e:
        # The rows exist but could not be queued (e.g. Redis unreachable). Mark
        # BOTH failed so neither dangles. The 502 detail is a FIXED message — the
        # enqueue exception can carry the broker URL + credentials and safe_error
        # only bounds (does not strip secrets) — so it is never echoed; the cause
        # is logged server-side (sanitized).
        logger.warning("Image job enqueue failed: %s", safe_error(e))
        job.status = JobStatus.FAILED
        job.error_message = "A feladat sorba állítása nem sikerült."
        asset.status = "failed"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not enqueue image job (queue unavailable).",
        )

    return MediaAssetRead.model_validate(asset)


@router.get("/images", response_model=list[MediaAssetRead])
async def list_images(
    entity_type: str,
    entity_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[MediaAssetRead]:
    """List an entity's generated images, newest-first.

    Both ``entity_type`` and ``entity_id`` are required query params (FastAPI
    returns 422 when either is missing)."""
    assets = await image_service.list_for_entity(db, entity_type, entity_id)
    return [MediaAssetRead.model_validate(a) for a in assets]


@router.get("/images/styles", response_model=list[ImageStyleInfo])
async def list_styles(
    entity_type: str,
    _: str = Depends(get_current_user),
) -> list[ImageStyleInfo]:
    """List the available image-prompt style presets for an entity type."""
    return [
        ImageStyleInfo(slug=s.slug, label=s.label, entity_type=s.entity_type)
        for s in available_styles(entity_type)
    ]


@router.post("/images/{asset_id}/canonical", response_model=MediaAssetRead)
async def set_canonical(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> MediaAssetRead:
    """Mark an image canonical (clears the flag on the entity's other images)."""
    try:
        asset = await image_service.set_canonical(db, asset_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="media asset not found")
    return MediaAssetRead.model_validate(asset)


@router.delete("/images/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(
    asset_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    """Delete an image (row + files)."""
    try:
        await image_service.delete(db, asset_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="media asset not found")


@router.get("/media/{asset_id}")
async def serve_media(
    asset_id: uuid.UUID,
    thumb: int = 0,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> FileResponse:
    """Stream a ready image's binary. ``?thumb=1`` serves the thumbnail.

    TRAVERSAL SAFETY: only the path STORED on the DB row is served (never a
    client-supplied path), and the resolved real path is additionally verified to
    live inside ``settings.media_dir`` — anything outside is refused as a 404, so
    a tampered row can never exfiltrate an arbitrary file."""
    asset = await db.get(MediaAsset, asset_id)
    if asset is None or asset.status != "ready":
        raise HTTPException(status_code=404, detail="media asset not found")

    path = asset.thumb_path if thumb else asset.file_path
    if not path:
        raise HTTPException(status_code=404, detail="media asset not found")

    # Confine the served file to media_dir (defense-in-depth against a tampered
    # DB row pointing outside the media root).
    real_path = os.path.realpath(path)
    media_root = os.path.realpath(settings.media_dir)
    if not (real_path == media_root or real_path.startswith(media_root + os.sep)):
        raise HTTPException(status_code=404, detail="media asset not found")
    if not os.path.isfile(real_path):
        raise HTTPException(status_code=404, detail="media asset not found")

    return FileResponse(real_path, media_type=asset.mime)
