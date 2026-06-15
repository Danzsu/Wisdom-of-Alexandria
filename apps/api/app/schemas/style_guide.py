import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class StyleGuideCreate(BaseModel):
    tone: str | None = None
    pov: str | None = None
    tense: str | None = None
    rules: dict | None = None
    examples: dict | None = None
    notes: str | None = None


class StyleGuideUpdate(BaseModel):
    tone: str | None = None
    pov: str | None = None
    tense: str | None = None
    rules: dict | None = None
    examples: dict | None = None
    notes: str | None = None


class StyleGuideRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    tone: str | None
    pov: str | None
    tense: str | None
    rules: dict | None
    examples: dict | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
