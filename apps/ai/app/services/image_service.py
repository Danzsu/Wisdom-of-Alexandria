"""ImageService — orchestrates Codex image generation (Phase 1).

Mirrors :class:`EmbeddingService`'s shape: an injectable ``router`` and async
methods that take an ``AsyncSession``. One generation flow:

    fetch entity → build prompt → (reuse canonical reference if present)
    → router.generate_image → save file + thumbnail → persist a READY MediaAsset

plus the lifecycle helpers ``set_canonical`` / ``list_for_entity`` / ``delete``.

Failure discipline: ``generate_for_entity`` is LOUD. Any failure in the provider
call or the save step cleans up a partial file and RE-RAISES — it never persists
a half-baked asset. The RQ job layer (T6) owns turning that exception into a
persisted ``failed`` status, so this service must not swallow it.
"""

from __future__ import annotations

import logging
import uuid

from alexandria_core.models.character import Character
from alexandria_core.models.location import Location
from alexandria_core.models.media_asset import MediaAsset
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import image_prompt
from app.services.image_storage import (
    SavedImage,
    delete_image_files,
    save_image,
)
from app.services.model_router import ModelRouter, model_router

logger = logging.getLogger(__name__)


class ImageService:
    """Generates + manages a Codex entity's generated images (MediaAsset rows)."""

    def __init__(self, router: ModelRouter | None = None):
        self.router = router or model_router

    # ── generation ───────────────────────────────────────────────────────────

    async def generate_for_entity(
        self,
        db: AsyncSession,
        *,
        project_id: uuid.UUID,
        entity_type: str,
        entity_id: uuid.UUID,
        style: str,
        model: str,
        job_id: uuid.UUID | None = None,
    ) -> MediaAsset:
        """Generate an image for a Character/Location and persist a READY asset.

        Reuses the entity's current canonical image (if any, and readable) as a
        reference image so successive generations stay visually consistent.
        Raises ``ValueError`` if the entity is missing. On ANY failure during the
        provider call or save step, removes any partial file and re-raises (loud).
        """
        entity = await self._fetch_entity(db, entity_type, entity_id)
        if entity is None:
            raise ValueError(
                f"{entity_type} {entity_id} not found for image generation"
            )

        prompt = self._build_prompt(entity_type, entity, style)
        reference = await self._canonical_reference_bytes(db, entity_type, entity_id)

        asset_id = uuid.uuid4()
        saved: SavedImage | None = None
        try:
            result = await self.router.generate_image(
                prompt,
                model=model,
                db=db,
                reference_images=reference,
                aspect_ratio="2:3",
            )
            from alexandria_core.core.config import settings

            saved = save_image(
                settings.media_dir, project_id, asset_id, result.data, result.mime
            )
        except Exception:
            # Loud: clean up any partial file, then re-raise so the job layer can
            # persist the failed status. NEVER persist a ready/partial asset here.
            if saved is not None:
                delete_image_files(saved.file_path, saved.thumb_path)
            raise

        asset = MediaAsset(
            id=asset_id,
            project_id=project_id,
            entity_type=entity_type,
            entity_id=entity_id,
            status="ready",
            file_path=saved.file_path,
            thumb_path=saved.thumb_path,
            mime=result.mime,
            width=saved.width,
            height=saved.height,
            model_name=result.model,
            style=style,
            prompt=prompt,
            job_id=job_id,
            is_canonical=False,
        )
        db.add(asset)
        await db.commit()
        await db.refresh(asset)
        return asset

    # ── listing ──────────────────────────────────────────────────────────────

    async def list_for_entity(
        self, db: AsyncSession, entity_type: str, entity_id: uuid.UUID
    ) -> list[MediaAsset]:
        """All assets for the entity, newest-first."""
        rows = (
            await db.execute(
                select(MediaAsset)
                .where(
                    MediaAsset.entity_type == entity_type,
                    MediaAsset.entity_id == entity_id,
                )
                .order_by(MediaAsset.created_at.desc())
            )
        ).scalars().all()
        return list(rows)

    # ── canonical ────────────────────────────────────────────────────────────

    async def set_canonical(self, db: AsyncSession, asset_id: uuid.UUID) -> MediaAsset:
        """Mark ``asset_id`` canonical and clear it on the entity's OTHER assets.

        Enforces the one-canonical-per-(entity_type, entity_id) invariant in a
        single commit. Raises ``ValueError`` if the asset is missing.
        """
        asset = await db.get(MediaAsset, asset_id)
        if asset is None:
            raise ValueError(f"media asset {asset_id} not found")

        siblings = (
            await db.execute(
                select(MediaAsset).where(
                    MediaAsset.entity_type == asset.entity_type,
                    MediaAsset.entity_id == asset.entity_id,
                    MediaAsset.is_canonical.is_(True),
                    MediaAsset.id != asset_id,
                )
            )
        ).scalars().all()
        for sib in siblings:
            sib.is_canonical = False
        asset.is_canonical = True

        await db.commit()
        await db.refresh(asset)
        return asset

    # ── delete ───────────────────────────────────────────────────────────────

    async def delete(self, db: AsyncSession, asset_id: uuid.UUID) -> None:
        """Delete the asset row + its files. Raises ``ValueError`` if missing."""
        asset = await db.get(MediaAsset, asset_id)
        if asset is None:
            raise ValueError(f"media asset {asset_id} not found")

        file_path, thumb_path = asset.file_path, asset.thumb_path
        await db.delete(asset)
        await db.commit()
        # Unlink AFTER the row is gone so a file error cannot leave a dangling row.
        delete_image_files(file_path, thumb_path)

    # ── internals ────────────────────────────────────────────────────────────

    async def _fetch_entity(
        self, db: AsyncSession, entity_type: str, entity_id: uuid.UUID
    ):
        if entity_type == "character":
            return await db.get(Character, entity_id)
        if entity_type == "location":
            return await db.get(Location, entity_id)
        return None

    def _build_prompt(self, entity_type: str, entity, style: str) -> str:
        if entity_type == "character":
            return image_prompt.build_character_prompt(entity, style)
        if entity_type == "location":
            return image_prompt.build_location_prompt(entity, style)
        raise ValueError(f"unsupported entity_type for image generation: {entity_type!r}")

    async def _canonical_reference_bytes(
        self, db: AsyncSession, entity_type: str, entity_id: uuid.UUID
    ) -> list[bytes] | None:
        """Return ``[bytes]`` of the entity's canonical ready image, else None.

        A missing/unreadable canonical file is treated as "no reference" (logged,
        not fatal) — consistency is best-effort, not a hard dependency.
        """
        canonical = (
            await db.execute(
                select(MediaAsset).where(
                    MediaAsset.entity_type == entity_type,
                    MediaAsset.entity_id == entity_id,
                    MediaAsset.status == "ready",
                    MediaAsset.is_canonical.is_(True),
                )
            )
        ).scalars().first()
        if canonical is None or not canonical.file_path:
            return None
        try:
            with open(canonical.file_path, "rb") as fh:
                payload = fh.read()
        except OSError:
            logger.warning(
                "canonical asset %s file unreadable; generating without reference",
                canonical.id,
            )
            return None
        return [payload] if payload else None


# Module-level singleton — import and use directly in routes / jobs.
image_service = ImageService()
