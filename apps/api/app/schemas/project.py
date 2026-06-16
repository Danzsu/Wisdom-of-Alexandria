import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProjectCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    language: str = Field(default="hu", max_length=10)


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    language: str | None = Field(default=None, max_length=10)


class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    description: str | None
    language: str
    created_at: datetime
    updated_at: datetime
    # Card aggregates (Feature #1). `book_count` = number of books in the project;
    # `word_count` = sum of Scene.word_count across every scene in every chapter of
    # every book. Computed on the read paths (list + get); create returns 0/0 since
    # a brand-new project has no books or scenes yet.
    book_count: int = 0
    word_count: int = 0
