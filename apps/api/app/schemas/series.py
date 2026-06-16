import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SeriesCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    order_index: int = 0


class SeriesUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    order_index: int | None = None


class SeriesRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str | None
    order_index: int
    created_at: datetime
    updated_at: datetime
