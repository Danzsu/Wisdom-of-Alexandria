import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class CodexEntryCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    entry_type: str = Field(default="custom", max_length=100)
    content: str | None = None
    aliases: list[str] = Field(default_factory=list)
    role: str | None = Field(default=None, max_length=100)
    ai_visible: bool = True
    tags: list[str] = Field(default_factory=list)


class CodexEntryUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    entry_type: str | None = Field(default=None, max_length=100)
    content: str | None = None
    aliases: list[str] | None = None
    role: str | None = Field(default=None, max_length=100)
    ai_visible: bool | None = None
    tags: list[str] | None = None


class CodexEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    entry_type: str
    content: str | None
    aliases: list[str]
    role: str | None
    ai_visible: bool
    tags: list[str]
    created_at: datetime
    updated_at: datetime

    # The model column is nullable (no Python-side default — see
    # alexandria_core.models.codex_entry). A normally-created/refreshed row
    # backfills to ``[]`` via the DB server_default, but coerce a stray ``None``
    # (e.g. a raw insert) to ``[]`` so this read view never raises on
    # serialization.
    @field_validator("aliases", "tags", mode="before")
    @classmethod
    def _none_to_empty_list(cls, v: list[str] | None) -> list[str]:
        return v if v is not None else []
