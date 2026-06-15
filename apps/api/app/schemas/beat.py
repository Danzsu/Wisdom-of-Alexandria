import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BeatCreate(BaseModel):
    description: str = Field(..., min_length=1)
    beat_type: str | None = Field(default=None, max_length=100)
    order_index: int = 0
    notes: str | None = None


class BeatUpdate(BaseModel):
    description: str | None = Field(default=None, min_length=1)
    beat_type: str | None = Field(default=None, max_length=100)
    order_index: int | None = None
    notes: str | None = None


class BeatReorder(BaseModel):
    order: list[uuid.UUID]


class BeatRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scene_id: uuid.UUID
    description: str
    beat_type: str | None
    order_index: int
    notes: str | None
    created_at: datetime
    updated_at: datetime
