import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

# Shared length bounds (kept in sync with the model column widths).
_NAME_MAX = 255
_CATEGORY_MAX = 100
_DESCRIPTION_MAX = 2000
_BODY_MAX = 20000
_ICON_KEY_MAX = 50


class PromptTemplateCreate(BaseModel):
    """Client payload for creating a user template.

    ``is_builtin`` and ``uses`` are intentionally NOT accepted — the server
    forces ``is_builtin=False`` / ``uses=0`` so clients cannot forge a builtin.
    """

    name: str = Field(..., min_length=1, max_length=_NAME_MAX)
    category: str = Field(..., min_length=1, max_length=_CATEGORY_MAX)
    description: str = Field(default="", max_length=_DESCRIPTION_MAX)
    body: str = Field(..., min_length=1, max_length=_BODY_MAX)
    icon_key: str | None = Field(default=None, max_length=_ICON_KEY_MAX)


class PromptTemplateUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=_NAME_MAX)
    category: str | None = Field(default=None, min_length=1, max_length=_CATEGORY_MAX)
    description: str | None = Field(default=None, max_length=_DESCRIPTION_MAX)
    body: str | None = Field(default=None, min_length=1, max_length=_BODY_MAX)
    icon_key: str | None = Field(default=None, max_length=_ICON_KEY_MAX)


class PromptTemplateUseResult(BaseModel):
    """New ``uses`` count after ``POST /{id}/use`` registered one application."""

    uses: int


class PromptTemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    category: str
    description: str
    body: str
    uses: int
    is_builtin: bool
    icon_key: str | None
    created_at: datetime
    updated_at: datetime
