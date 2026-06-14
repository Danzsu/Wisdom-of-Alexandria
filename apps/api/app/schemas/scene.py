import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class SceneCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str | None = None
    summary: str | None = None
    order_index: int = 0
    status: str = "draft"
    pov_character_id: uuid.UUID | None = None


class SceneUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = None
    summary: str | None = None
    order_index: int | None = None
    status: str | None = None
    pov_character_id: uuid.UUID | None = None


class SceneReorder(BaseModel):
    order: list[uuid.UUID]


class SceneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    chapter_id: uuid.UUID
    title: str
    content: str | None
    summary: str | None
    order_index: int
    status: str
    word_count: int
    pov_character_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
