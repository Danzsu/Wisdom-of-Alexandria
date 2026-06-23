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

from alexandria_core.models.book import Book
from alexandria_core.models.codex_entry import CodexEntry
from alexandria_core.models.media_asset import MediaAsset
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services import cover_compositor, image_prompt
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
        asset_id: uuid.UUID,
        job_id: uuid.UUID | None = None,
    ) -> MediaAsset:
        """Generate an image for a Codex entry and update the EXISTING placeholder.

        ``entity_id`` is a ``CodexEntry`` id; ``entity_type`` is its expected
        ``entry_type`` ("character" | "location"). Reuses the entity's current
        canonical image (if any, and readable) as a reference image so successive
        generations stay visually consistent. Raises ``ValueError`` if the entry
        is missing OR its ``entry_type`` does not match ``entity_type``, or if the
        placeholder asset ``asset_id`` does not exist. On ANY failure during the
        provider call or save step, removes any partial file and re-raises (loud).
        """
        asset = await db.get(MediaAsset, asset_id)
        if asset is None:
            raise ValueError(
                f"placeholder asset {asset_id} not found for image generation"
            )

        entry = await db.get(CodexEntry, entity_id)
        if entry is None or entry.entry_type != entity_type:
            raise ValueError(
                f"codex entry {entity_id} not found or not a {entity_type} "
                "for image generation"
            )

        prompt = image_prompt.build_codex_prompt(entry, style)
        reference = await self._canonical_reference_bytes(db, entity_type, entity_id)

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

        # Update the existing placeholder in-place — never create a second row.
        asset.file_path = saved.file_path
        asset.thumb_path = saved.thumb_path
        asset.mime = result.mime
        asset.width = saved.width
        asset.height = saved.height
        asset.model_name = result.model
        asset.prompt = prompt
        asset.status = "ready"
        if job_id is not None:
            asset.job_id = job_id
        await db.commit()
        await db.refresh(asset)
        return asset

    async def generate_cover_for_book(
        self,
        db: AsyncSession,
        *,
        project_id: uuid.UUID,
        book_id: uuid.UUID,
        art_style: str,
        layout: str,
        title: str,
        author: str,
        subtitle: str | None,
        model: str,
        asset_id: uuid.UUID,
        job_id: uuid.UUID | None = None,
    ) -> MediaAsset:
        """Generate a book cover: art (text-free) → composite typography → READY
        ``MediaAsset(entity_type="cover", entity_id=book_id)``. Updates the
        EXISTING placeholder identified by ``asset_id`` in-place rather than
        creating a new row. Loud on failure (cleans up a partial file, re-raises).
        Raises ``ValueError`` if the book or the placeholder asset is missing."""
        asset = await db.get(MediaAsset, asset_id)
        if asset is None:
            raise ValueError(
                f"placeholder asset {asset_id} not found for cover generation"
            )

        book = await db.get(Book, book_id)
        if book is None or book.project_id != project_id:
            raise ValueError(f"book {book_id} not found for cover generation")

        prompt = image_prompt.build_cover_prompt(book, art_style)
        saved: SavedImage | None = None
        try:
            result = await self.router.generate_image(
                prompt, model=model, db=db, aspect_ratio="2:3"
            )
            composed = cover_compositor.compose_cover(
                result.data, layout=layout, title=title, author=author, subtitle=subtitle
            )
            from alexandria_core.core.config import settings

            saved = save_image(
                settings.media_dir, project_id, asset_id, composed, "image/png"
            )
        except Exception:
            if saved is not None:
                delete_image_files(saved.file_path, saved.thumb_path)
            raise

        # Update the existing placeholder in-place — never create a second row.
        asset.file_path = saved.file_path
        asset.thumb_path = saved.thumb_path
        asset.mime = "image/png"
        asset.width = saved.width
        asset.height = saved.height
        asset.model_name = result.model
        asset.prompt = prompt
        asset.status = "ready"
        if job_id is not None:
            asset.job_id = job_id
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
