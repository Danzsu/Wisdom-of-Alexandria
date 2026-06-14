import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class BookCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    synopsis: str | None = None
    genre: str | None = Field(default=None, max_length=100)
    language: str = Field(default="hu", max_length=10)
    word_count_target: int | None = None
    order_index: int = 0


class BookUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    synopsis: str | None = None
    genre: str | None = Field(default=None, max_length=100)
    language: str | None = Field(default=None, max_length=10)
    word_count_target: int | None = None
    order_index: int | None = None


class BookRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str | None
    synopsis: str | None
    genre: str | None
    language: str
    word_count_target: int | None
    order_index: int
    created_at: datetime
    updated_at: datetime
