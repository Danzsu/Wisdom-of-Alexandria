"""RAG-into-generation integration (B2b).

Covers the AIService side of RAG:
  * project resolution from scene_id (scene→chapter→book→project),
  * graceful degradation when no embedding provider is configured (no crash,
    empty context_entities, no embed call),
  * the {context} injection — with retrieval mocked, the BUILT user prompt sent
    to the model contains the retrieved snippet (rewrite / generate_scene /
    write_continue),
  * context_entities flow back through the service return contract,
  * RAG retrieval failure degrades to no-context (does NOT crash the generation).

Only the LLM call (router.complete) and the embedding layer are controlled; the
real PromptLoader renders the real templates so the {context} placeholder is
genuinely exercised.
"""

import logging
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.project import Project
from alexandria_core.models.scene import Scene
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ai_service import AIService
from app.services.embedding_service import EmbeddingService, RetrievedItem
from app.services.model_router import ModelResponse, ModelRouter
from app.services.prompt_loader import prompt_loader
from app.services.revision_service import revision_service

SNIPPET = "EGYEDI-KONTEXTUS-JELZO: az ősi kard a hegy gyomrában pihen."
ENTITY_ID = uuid.uuid4()


def _capturing_router() -> ModelRouter:
    """Real-ish router that records the messages passed to complete()."""
    router = AsyncMock(spec=ModelRouter)
    router.build_messages.side_effect = lambda system, user: [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    router.complete.return_value = ModelResponse(
        content="Generált.", model="ollama/llama3.2", usage={}
    )
    return router


def _embeddings_returning(snippet: str | None) -> EmbeddingService:
    """An EmbeddingService stub: a model IS configured and retrieve returns one
    item (or none when ``snippet`` is None)."""
    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = "openai/text-embedding-3-small"
    emb.sync_project.return_value = MagicMock()
    if snippet is None:
        emb.retrieve.return_value = []
    else:
        emb.retrieve.return_value = [
            RetrievedItem(
                entity_type="character",
                entity_id=ENTITY_ID,
                label="Aragorn",
                snippet=snippet,
                distance=0.01,
            )
        ]
    return emb


def _embeddings_no_provider() -> EmbeddingService:
    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = None  # RAG unconfigured
    return emb


async def _make_scene(db: AsyncSession) -> tuple[uuid.UUID, uuid.UUID]:
    """Create project→book→chapter→scene; return (scene_id, project_id)."""
    project = Project(title="RAG int projekt")
    db.add(project)
    await db.flush()
    book = Book(project_id=project.id, title="Könyv")
    db.add(book)
    await db.flush()
    chapter = Chapter(book_id=book.id, title="Fejezet")
    db.add(chapter)
    await db.flush()
    scene = Scene(chapter_id=chapter.id, title="Jelenet", content="Szöveg.")
    db.add(scene)
    await db.commit()
    return scene.id, project.id


# ── project resolution ─────────────────────────────────────────────────────────


@pytest.mark.integration
async def test_resolve_project_id_from_scene(db_session):
    scene_id, project_id = await _make_scene(db_session)
    svc = AIService(
        router=_capturing_router(),
        loader=prompt_loader,
        svc=revision_service,
        embeddings=_embeddings_returning(SNIPPET),
    )
    resolved = await svc._resolve_project_id(db_session, scene_id)
    assert resolved == project_id


@pytest.mark.integration
async def test_resolve_project_id_none_for_missing_scene(db_session):
    svc = AIService(embeddings=_embeddings_returning(SNIPPET))
    assert await svc._resolve_project_id(db_session, uuid.uuid4()) is None
    assert await svc._resolve_project_id(db_session, None) is None


# ── {context} injection into the built prompt ──────────────────────────────────


@pytest.mark.integration
async def test_rewrite_injects_retrieved_snippet_into_prompt(db_session):
    scene_id, _ = await _make_scene(db_session)
    router = _capturing_router()
    svc = AIService(
        router=router,
        loader=prompt_loader,
        svc=revision_service,
        embeddings=_embeddings_returning(SNIPPET),
    )
    _rev, _job, context_entities = await svc.rewrite(
        db_session,
        selected_text="Eredeti.",
        instruction="Javítsd",
        scene_id=scene_id,
        model="ollama/llama3.2",
    )
    user_msg = router.complete.call_args.kwargs["messages"][1]["content"]
    assert SNIPPET in user_msg
    assert context_entities == [
        {"id": str(ENTITY_ID), "label": "Aragorn", "entity_type": "character"}
    ]


@pytest.mark.integration
async def test_generate_scene_injects_retrieved_snippet_into_prompt(db_session):
    scene_id, _ = await _make_scene(db_session)
    router = _capturing_router()
    svc = AIService(
        router=router,
        loader=prompt_loader,
        svc=revision_service,
        embeddings=_embeddings_returning(SNIPPET),
    )
    _rev, _job, context_entities = await svc.generate_scene(
        db_session,
        beats=["A hős belép"],
        scene_id=scene_id,
        model="ollama/llama3.2",
    )
    user_msg = router.complete.call_args.kwargs["messages"][1]["content"]
    assert SNIPPET in user_msg
    assert len(context_entities) == 1


@pytest.mark.integration
async def test_write_continue_injects_retrieved_snippet_into_prompt(db_session):
    scene_id, _ = await _make_scene(db_session)
    router = _capturing_router()
    svc = AIService(
        router=router,
        loader=prompt_loader,
        svc=revision_service,
        embeddings=_embeddings_returning(SNIPPET),
    )
    _rev, _job, context_entities = await svc.write_continue(
        db_session,
        scene_text="A jelenet eddigi szövege.",
        scene_id=scene_id,
        model="ollama/llama3.2",
    )
    user_msg = router.complete.call_args.kwargs["messages"][1]["content"]
    assert SNIPPET in user_msg
    assert len(context_entities) == 1


# ── graceful degradation ───────────────────────────────────────────────────────


@pytest.mark.integration
async def test_rag_skipped_when_no_provider_configured(db_session):
    """No embedding provider → empty context_entities, no crash, no embed call."""
    scene_id, _ = await _make_scene(db_session)
    emb = _embeddings_no_provider()
    router = _capturing_router()
    svc = AIService(
        router=router, loader=prompt_loader, svc=revision_service, embeddings=emb
    )
    _rev, _job, context_entities = await svc.rewrite(
        db_session,
        selected_text="x",
        instruction="y",
        scene_id=scene_id,
        model="ollama/llama3.2",
    )
    assert context_entities == []
    # retrieve / sync must NOT be attempted once the model is unresolved.
    emb.retrieve.assert_not_called()
    emb.sync_project.assert_not_called()
    # The generation still happened (the {context} placeholder rendered empty).
    user_msg = router.complete.call_args.kwargs["messages"][1]["content"]
    assert SNIPPET not in user_msg


@pytest.mark.integration
async def test_rag_skipped_when_no_scene_id(db_session):
    """No scene_id → no project → RAG skipped gracefully."""
    emb = _embeddings_returning(SNIPPET)
    svc = AIService(
        router=_capturing_router(),
        loader=prompt_loader,
        svc=revision_service,
        embeddings=emb,
    )
    _rev, _job, context_entities = await svc.rewrite(
        db_session, selected_text="x", instruction="y", model="ollama/llama3.2"
    )
    assert context_entities == []
    emb.retrieve.assert_not_called()


@pytest.mark.integration
async def test_rag_retrieval_failure_degrades_to_no_context(db_session, caplog):
    """A retrieval blow-up must NOT crash the generation — it degrades to empty
    context, LOGS A WARNING (never silent), and the write still completes."""
    scene_id, _ = await _make_scene(db_session)
    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = "openai/text-embedding-3-small"
    emb.sync_project.side_effect = RuntimeError("embedding provider down")
    router = _capturing_router()
    svc = AIService(
        router=router, loader=prompt_loader, svc=revision_service, embeddings=emb
    )

    with caplog.at_level(logging.WARNING, logger="app.services.ai_service"):
        revision, _job, context_entities = await svc.rewrite(
            db_session,
            selected_text="Eredeti.",
            instruction="Javítsd",
            scene_id=scene_id,
            model="ollama/llama3.2",
        )
    # Generation succeeded despite the RAG failure; context is empty.
    assert revision is not None
    assert context_entities == []
    router.complete.assert_called_once()
    # The degradation was LOGGED at WARNING (a regression to DEBUG / no-log fails
    # here) — the standing bar forbids silently swallowing the RAG failure.
    assert any(
        r.levelno == logging.WARNING and "RAG retrieval failed" in r.getMessage()
        for r in caplog.records
    )
