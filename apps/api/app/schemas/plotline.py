import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Allowed value sets — validated at the schema layer (the DB stores plain str,
# per the project convention for status-like enums). Invalid values raise 422.
PlotlineType = Literal[
    "main_plot",
    "subplot",
    "character_arc",
    "romance",
    "mystery",
    "antagonist_plan",
    "world_conflict",
]
PlotlineStatus = Literal["planning", "active", "resolved", "abandoned"]


class PlotlineCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    plotline_type: PlotlineType
    status: PlotlineStatus = "planning"
    # Optional book scope; None = project-wide. Validated against the project at
    # the CRUD layer (cross-project book_id rejected).
    book_id: uuid.UUID | None = None
    order_index: int = 0


class PlotlineUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    plotline_type: PlotlineType | None = None
    status: PlotlineStatus | None = None
    book_id: uuid.UUID | None = None
    order_index: int | None = None


class PlotlineRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    book_id: uuid.UUID | None
    title: str
    description: str | None
    plotline_type: str
    status: str
    order_index: int
    created_at: datetime
    updated_at: datetime


class PlotlineSceneCreate(BaseModel):
    scene_id: uuid.UUID
    order_index: int = 0


class PlotlineSceneRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    plotline_id: uuid.UUID
    scene_id: uuid.UUID
    order_index: int
    created_at: datetime
    updated_at: datetime
