import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ChapterCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    summary: str | None = None
    order_index: int = 0
    status: str = "draft"


class ChapterUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    summary: str | None = None
    order_index: int | None = None
    status: str | None = None


class ChapterReorder(BaseModel):
    order: list[uuid.UUID]


class ChapterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    book_id: uuid.UUID
    title: str
    summary: str | None
    order_index: int
    status: str
    created_at: datetime
    updated_at: datetime
