import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class RevisionRead(BaseModel):
    """Read view of a Revision.

    Shared because two services produce/consume it across the service boundary:
    ``apps/ai`` creates Revisions from AI output and returns them; ``apps/api``
    lists them and applies the human-in-the-loop approve/reject (mutating Scene).
    Both read the same shared Postgres rows, so the contract lives here.
    """

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
