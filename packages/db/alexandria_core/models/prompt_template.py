from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from alexandria_core.models.base import Base, Timestamps, UUIDPrimaryKey


class PromptTemplate(UUIDPrimaryKey, Timestamps, Base):
    """User-facing prompt-library template (workspace-GLOBAL — no project_id).

    This is the browsable/creatable catalogue surfaced by the "Prompt könyvtár"
    screen, NOT the internal AI system-prompt templates in ``packages/prompts``.
    Built-in templates (``is_builtin=True``) are seeded and may not be edited or
    deleted by clients; user-created templates are fully mutable.
    """

    __tablename__ = "prompt_templates"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # The template body with ``{token}`` placeholders.
    body: Mapped[str] = mapped_column(Text, nullable=False)
    uses: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_builtin: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Maps to a lucide icon in the frontend (e.g. "sparkles"/"eye"/"brain").
    icon_key: Mapped[str | None] = mapped_column(String(50), nullable=True)
