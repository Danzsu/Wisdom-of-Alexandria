import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class RevisionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scene_id: uuid.UUID | None
    job_id: uuid.UUID | None
    content: str
    approved: bool
    revision_type: str
    model_name: str | None
    prompt_version: str | None
    created_at: datetime
    updated_at: datetime
