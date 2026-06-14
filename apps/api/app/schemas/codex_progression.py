import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CodexProgressionCreate(BaseModel):
    entity_type: str = Field(..., max_length=100)
    entity_id: uuid.UUID
    chapter_id: uuid.UUID | None = None
    scene_id: uuid.UUID | None = None
    note: str | None = None


class CodexProgressionUpdate(BaseModel):
    chapter_id: uuid.UUID | None = None
    scene_id: uuid.UUID | None = None
    note: str | None = None


class CodexProgressionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    entity_type: str
    entity_id: uuid.UUID
    chapter_id: uuid.UUID | None
    scene_id: uuid.UUID | None
    note: str | None
    created_at: datetime
    updated_at: datetime
