import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class GenerationJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    scene_id: uuid.UUID | None
    chapter_id: uuid.UUID | None
    job_type: str
    status: str
    model_name: str | None
    prompt_version: str | None
    input_data: dict | None
    output_data: dict | None
    error_message: str | None
    created_at: datetime
    updated_at: datetime
