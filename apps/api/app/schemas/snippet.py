import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class SnippetCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    source_scene_id: uuid.UUID | None = None
    tags: list[str] = Field(default_factory=list)


class SnippetUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    content: str | None = Field(default=None, min_length=1)
    source_scene_id: uuid.UUID | None = None
    tags: list[str] | None = None


class SnippetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    content: str
    source_scene_id: uuid.UUID | None
    tags: list[str]
    created_at: datetime
    updated_at: datetime
