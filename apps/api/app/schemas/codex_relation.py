import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CodexRelationCreate(BaseModel):
    from_entity_type: str = Field(..., max_length=100)
    from_entity_id: uuid.UUID
    to_entity_type: str = Field(..., max_length=100)
    to_entity_id: uuid.UUID
    relation_type: str = Field(..., max_length=100)
    description: str | None = None


class CodexRelationUpdate(BaseModel):
    relation_type: str | None = Field(default=None, max_length=100)
    description: str | None = None


class CodexRelationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    project_id: uuid.UUID
    from_entity_type: str
    from_entity_id: uuid.UUID
    to_entity_type: str
    to_entity_id: uuid.UUID
    relation_type: str
    description: str | None
    created_at: datetime
    updated_at: datetime
