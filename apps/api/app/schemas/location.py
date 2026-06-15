import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class LocationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    geography: str | None = None
    atmosphere: str | None = None
    ai_visible: bool = True
    notes: str | None = None


class LocationUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    geography: str | None = None
    atmosphere: str | None = None
    ai_visible: bool | None = None
    notes: str | None = None


class LocationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    description: str | None
    geography: str | None
    atmosphere: str | None
    ai_visible: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime
