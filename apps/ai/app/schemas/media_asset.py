"""Schemas for the AI image-generation HTTP layer (Phase 1).

``MediaAssetRead`` is the safe client view of a generated image: it deliberately
omits ``file_path`` / ``thumb_path`` — the client never sees a filesystem path
and builds the image URL from the asset ``id`` (``GET /ai/media/{id}``).
"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class MediaAssetRead(BaseModel):
    """Client view of a generated image. NO file_path/thumb_path (the client
    builds the URL from ``id``)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID | None
    status: str
    mime: str
    width: int | None
    height: int | None
    model_name: str | None
    style: str | None
    is_canonical: bool
    created_at: datetime


class ImageGenerateRequest(BaseModel):
    """Enqueue an image-generation job for a Codex entity."""

    entity_type: str
    entity_id: uuid.UUID
    project_id: uuid.UUID
    style: str = Field(min_length=1)
    # Optional explicit model override; defaults to the configured provider's
    # image_model when omitted.
    model: str | None = None


class ImageStyleInfo(BaseModel):
    """A selectable image-prompt style preset."""

    slug: str
    label: str
    entity_type: str
