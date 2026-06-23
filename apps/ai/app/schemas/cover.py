"""Schemas for the cover-generation HTTP layer (Phase 2)."""
import uuid

from pydantic import BaseModel, Field


class CoverGenerateRequest(BaseModel):
    book_id: uuid.UUID
    art_style: str = Field(min_length=1)
    layout: str = Field(min_length=1)
    title: str | None = None  # defaults to book.title
    author: str | None = None  # defaults to book.author
    subtitle: str | None = None
    model: str | None = None  # defaults to the provider's image_model


class CoverLayoutInfo(BaseModel):
    slug: str
    label: str
