"""Filesystem persistence for generated images (Phase 1 — AI image generation).

The DB row (``MediaAsset``) only carries metadata; the binary itself lives on
disk under the configured ``media_dir``. This module is the SINGLE place that
touches that filesystem, so the path layout + thumbnailing live in one place.

Path layout (keyed ONLY by ``project_id`` / ``asset_id`` UUIDs — never by any
client-supplied string, so there is no path-traversal surface):

    <media_dir>/<project_id>/<asset_id>.png         full image
    <media_dir>/<project_id>/<asset_id>.thumb.png   <=512px thumbnail
"""

from __future__ import annotations

import io
import os
import uuid
from dataclasses import dataclass

from alexandria_core.core.config import settings
from PIL import Image

# Longest-side cap for the generated thumbnail.
THUMB_MAX_PX = 512


@dataclass
class SavedImage:
    """Result of persisting an image to disk: paths + the full image's dims."""

    file_path: str
    thumb_path: str
    width: int
    height: int


def save_image(
    media_dir: str,
    project_id: uuid.UUID,
    asset_id: uuid.UUID,
    data: bytes,
    mime: str,
) -> SavedImage:
    """Write ``data`` (+ a thumbnail) under ``media_dir`` and return the paths.

    Enforces the ``settings.max_image_bytes`` ceiling LOUDLY (``ValueError``)
    before writing anything, so an oversized payload never lands on disk. The
    full image is decoded once with Pillow to record its real width/height and
    to derive a downscaled (<= ``THUMB_MAX_PX`` longest side, aspect-preserving)
    thumbnail.

    ``mime`` is accepted for parity with the asset metadata but the on-disk
    encoding is always PNG (deterministic, lossless) regardless of the provider's
    declared type — the filenames reflect that.
    """
    if len(data) > settings.max_image_bytes:
        raise ValueError(
            f"image payload {len(data)} bytes exceeds the "
            f"{settings.max_image_bytes}-byte limit"
        )

    project_dir = os.path.join(media_dir, str(project_id))
    os.makedirs(project_dir, exist_ok=True)
    file_path = os.path.join(project_dir, f"{asset_id}.png")
    thumb_path = os.path.join(project_dir, f"{asset_id}.thumb.png")

    # Decode once to learn the real dimensions and to build the thumbnail.
    with Image.open(io.BytesIO(data)) as img:
        img.load()
        width, height = img.size
        # Persist the full image as PNG.
        full = img.convert("RGB") if img.mode not in ("RGB", "RGBA") else img
        full.save(file_path, "PNG")
        # Aspect-preserving thumbnail, longest side <= THUMB_MAX_PX.
        thumb = full.copy()
        thumb.thumbnail((THUMB_MAX_PX, THUMB_MAX_PX))
        thumb.save(thumb_path, "PNG")

    return SavedImage(
        file_path=file_path, thumb_path=thumb_path, width=width, height=height
    )


def delete_image_files(file_path: str | None, thumb_path: str | None) -> None:
    """Best-effort unlink of an asset's files; missing files are ignored."""
    for path in (file_path, thumb_path):
        if not path:
            continue
        try:
            os.unlink(path)
        except FileNotFoundError:
            pass
        except OSError:
            # Best-effort: a locked/transient failure must not block row deletion.
            pass
