import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BookCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    author: str | None = Field(default=None, max_length=255)
    description: str | None = None
    synopsis: str | None = None
    genre: str | None = Field(default=None, max_length=100)
    language: str = Field(default="hu", max_length=10)
    word_count_target: int | None = None
    order_index: int = 0
    # Optional sub-universe grouping (a Series under the same project). None =
    # the book belongs to no series. Validated same-project at the service layer.
    series_id: uuid.UUID | None = None


class BookUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    author: str | None = Field(default=None, max_length=255)
    description: str | None = None
    synopsis: str | None = None
    genre: str | None = Field(default=None, max_length=100)
    language: str | None = Field(default=None, max_length=10)
    word_count_target: int | None = None
    order_index: int | None = None
    # Assign/clear the book's series. Send null to clear (back to project-only).
    # Set must reference a Series in the SAME project (else rejected).
    series_id: uuid.UUID | None = None


class BookRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    series_id: uuid.UUID | None = None
    title: str
    author: str | None
    description: str | None
    synopsis: str | None
    genre: str | None
    language: str
    word_count_target: int | None
    order_index: int
    created_at: datetime
    updated_at: datetime
