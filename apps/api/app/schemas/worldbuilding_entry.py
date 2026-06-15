import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WorldbuildingEntryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    category: str | None = Field(default=None, max_length=100)
    description: str | None = None
    ai_visible: bool = True
    notes: str | None = None


class WorldbuildingEntryUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    category: str | None = Field(default=None, max_length=100)
    description: str | None = None
    ai_visible: bool | None = None
    notes: str | None = None


class WorldbuildingEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    category: str | None
    description: str | None
    ai_visible: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime
