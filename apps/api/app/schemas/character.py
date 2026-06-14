import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CharacterCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    aliases: list[str] = Field(default_factory=list)
    description: str | None = None
    backstory: str | None = None
    personality: str | None = None
    appearance: str | None = None
    role: str | None = Field(default=None, max_length=100)
    ai_visible: bool = True
    notes: str | None = None


class CharacterUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    aliases: list[str] | None = None
    description: str | None = None
    backstory: str | None = None
    personality: str | None = None
    appearance: str | None = None
    role: str | None = Field(default=None, max_length=100)
    ai_visible: bool | None = None
    notes: str | None = None


class CharacterRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    aliases: list[str]
    description: str | None
    backstory: str | None
    personality: str | None
    appearance: str | None
    role: str | None
    ai_visible: bool
    notes: str | None
    created_at: datetime
    updated_at: datetime
