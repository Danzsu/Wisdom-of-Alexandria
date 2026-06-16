"""Continuity-checker DB integration (B3).

Exercises the parts of AIService.check_continuity that touch a real DB session:
  * scene-content loading (scene→content) for an existing scene,
  * the bad/empty-scene contract: a scene_id with no scene (or no content)
    yields an empty result (no warnings, no LLM call) — documented behaviour,
    NOT a crash,
  * project resolution + the {codex_context}/{content} placeholders rendered by
    the REAL prompt template (so the restructured continuity_check.md is
    genuinely exercised and no literal placeholder leaks).

Only the LLM call (router.complete) + the embedding layer are controlled.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.project import Project
from alexandria_core.models.scene import Scene
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ai_service import AIService
from app.services.embedding_service import EmbeddingService
from app.services.model_router import ModelResponse, ModelRouter
from app.services.prompt_loader import prompt_loader
from app.services.revision_service import revision_service

SCENE_CONTENT = "EGYEDI-JELENET-JELZO: Szelene a tekercsek közé hajolt."


def _capturing_router(content="[]") -> ModelRouter:
    router = AsyncMock(spec=ModelRouter)
    router.build_messages.side_effect = lambda system, user: [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    router.complete.return_value = ModelResponse(
        content=content, model="ollama/llama3.2", usage={}
    )
    return router


def _embeddings_no_provider() -> EmbeddingService:
    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = None
    return emb


def _embeddings_with(snippet: str) -> EmbeddingService:
    from app.services.embedding_service import RetrievedItem

    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = "openai/text-embedding-3-small"
    emb.sync_project.return_value = MagicMock()
    emb.retrieve.return_value = [
        RetrievedItem(
            entity_type="character",
            entity_id=uuid.uuid4(),
            label="Szelene",
            snippet=snippet,
            distance=0.01,
        )
    ]
    return emb


async def _make_scene(db: AsyncSession, content=SCENE_CONTENT) -> uuid.UUID:
    project = Project(title="Kont. int projekt")
    db.add(project)
    await db.flush()
    book = Book(project_id=project.id, title="Könyv")
    db.add(book)
    await db.flush()
    chapter = Chapter(book_id=book.id, title="Fejezet")
    db.add(chapter)
    await db.flush()
    scene = Scene(chapter_id=chapter.id, title="Jelenet", content=content)
    db.add(scene)
    await db.commit()
    return scene.id


@pytest.mark.integration
async def test_check_continuity_loads_scene_content_into_prompt(db_session):
    """The real scene content reaches the {content} placeholder of the real
    template — confirming load + no literal placeholder leak."""
    scene_id = await _make_scene(db_session)
    router = _capturing_router("[]")
    service = AIService(
        router=router,
        loader=prompt_loader,
        svc=revision_service,
        embeddings=_embeddings_no_provider(),
    )
    warnings, job, _ce = await service.check_continuity(
        db_session, scene_id=scene_id, model="ollama/llama3.2"
    )
    assert warnings == []
    user_msg = router.complete.call_args.kwargs["messages"][1]["content"]
    assert SCENE_CONTENT in user_msg
    # The restructured template must not leak literal placeholders.
    assert "{content}" not in user_msg
    assert "{codex_context}" not in user_msg
    system_msg = router.complete.call_args.kwargs["messages"][0]["content"]
    # System section (pure instructions) carries NO placeholders.
    assert "{content}" not in system_msg
    assert "{codex_context}" not in system_msg


@pytest.mark.integration
async def test_check_continuity_injects_codex_context(db_session):
    scene_id = await _make_scene(db_session)
    snippet = "KODEX-JELZO: Szelene a Nagykönyvtár éjszakai írnoka."
    router = _capturing_router("[]")
    service = AIService(
        router=router,
        loader=prompt_loader,
        svc=revision_service,
        embeddings=_embeddings_with(snippet),
    )
    _w, _j, context_entities = await service.check_continuity(
        db_session, scene_id=scene_id, model="ollama/llama3.2"
    )
    user_msg = router.complete.call_args.kwargs["messages"][1]["content"]
    assert snippet in user_msg
    assert len(context_entities) == 1


@pytest.mark.integration
async def test_check_continuity_bad_scene_returns_empty(db_session):
    """A scene_id with no scene → empty result (no warnings, NO LLM call)."""
    router = _capturing_router("[]")
    service = AIService(
        router=router,
        loader=prompt_loader,
        svc=revision_service,
        embeddings=_embeddings_no_provider(),
    )
    warnings, job, context_entities = await service.check_continuity(
        db_session, scene_id=uuid.uuid4(), model="ollama/llama3.2"
    )
    assert warnings == []
    assert context_entities == []
    # No content → the model is never called (nothing to check).
    router.complete.assert_not_called()


@pytest.mark.integration
async def test_check_continuity_empty_content_scene_returns_empty(db_session):
    """A scene that exists but has no content → empty result, no LLM call."""
    scene_id = await _make_scene(db_session, content=None)
    router = _capturing_router("[]")
    service = AIService(
        router=router,
        loader=prompt_loader,
        svc=revision_service,
        embeddings=_embeddings_no_provider(),
    )
    warnings, _job, _ce = await service.check_continuity(
        db_session, scene_id=scene_id, model="ollama/llama3.2"
    )
    assert warnings == []
    router.complete.assert_not_called()
