"""Embedding-dimension validation before insert (P1).

The stored vector column is fixed at ``settings.embedding_dim`` (1536). A provider
that emits a different width (e.g. Ollama nomic-embed-text = 768) would silently
break RAG (swallowed into "no context") and 502 the index path with no actionable
message. ``sync_project`` now validates the width before inserting and raises a
CLEAR error naming the expected vs actual dim, while a correct-width vector still
indexes normally.
"""

import uuid

import pytest
from alexandria_core.core.config import settings
from alexandria_core.models.codex_entry import CodexEntry
from alexandria_core.models.project import Project

from app.services.embedding_service import EmbeddingDimError, EmbeddingService

# Reuse the project + wrong/right-dim mock router helpers from the service tests.
from tests.integration.test_embedding_service import _mock_router

pytestmark = pytest.mark.integration

EMBED_MODEL = "openai/text-embedding-3-small"


async def _make_project_with_codex(db) -> uuid.UUID:
    project = Project(title="Dim projekt")
    db.add(project)
    await db.flush()
    db.add(
        CodexEntry(
            project_id=project.id,
            title="Aranykard",
            content="Egy legendás penge.",
            ai_visible=True,
        )
    )
    await db.commit()
    return project.id


async def test_sync_rejects_wrong_dimension_with_clear_message(db_session):
    project_id = await _make_project_with_codex(db_session)
    expected = settings.embedding_dim
    wrong = expected - 1 if expected > 1 else expected + 1
    svc = EmbeddingService(router=_mock_router(dim=wrong))

    with pytest.raises(EmbeddingDimError) as exc_info:
        await svc.sync_project(db_session, project_id, embedding_model=EMBED_MODEL)

    msg = str(exc_info.value)
    # Both expected and actual width must appear so the operator can act.
    assert str(expected) in msg
    assert str(wrong) in msg
    # And it names the offending model.
    assert EMBED_MODEL in msg


async def test_sync_accepts_correct_dimension(db_session):
    project_id = await _make_project_with_codex(db_session)
    svc = EmbeddingService(router=_mock_router(dim=settings.embedding_dim))
    result = await svc.sync_project(
        db_session, project_id, embedding_model=EMBED_MODEL
    )
    assert result.indexed == 1
