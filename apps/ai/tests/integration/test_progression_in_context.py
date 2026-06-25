"""Wiring: progression "state as of S" is injected into the AI prompt context.

These exercise the AIService context-build path end-to-end (retrieval mocked,
real PromptLoader + a real DB book/chapter/scene + real progressions): the
progression note that is current as-of the target scene must appear in the user
prompt sent to the model, and a FUTURE progression must NOT.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.character import Character
from alexandria_core.models.codex_progression import CodexProgression
from alexandria_core.models.project import Project
from alexandria_core.models.scene import Scene
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ai_service import AIService
from app.services.embedding_service import EmbeddingService, RetrievedItem
from app.services.model_router import ModelResponse, ModelRouter
from app.services.prompt_loader import prompt_loader
from app.services.revision_service import revision_service

PAST_STATE = "ALLAPOT-MULT: a kard eltört a csatában."
FUTURE_STATE = "ALLAPOT-JOVO: a kardot újrakovácsolták."


def _capturing_router() -> ModelRouter:
    router = AsyncMock(spec=ModelRouter)
    router.build_messages.side_effect = lambda system, user: [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    router.complete.return_value = ModelResponse(
        content="Generált.", model="ollama/llama3.2", usage={}
    )
    return router


def _embeddings_returning_character(char_id: uuid.UUID) -> EmbeddingService:
    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = "openai/text-embedding-3-small"
    emb.sync_project.return_value = MagicMock()
    emb.retrieve.return_value = [
        RetrievedItem(
            entity_type="character",
            entity_id=char_id,
            label="Aragorn",
            snippet="A király.",
            distance=0.01,
        )
    ]
    return emb


async def _make_scene_with_progressions(
    db: AsyncSession,
) -> tuple[uuid.UUID, uuid.UUID]:
    """project→book→chapter→[s0 (target), s1 (future)] + a char with a PAST and
    a FUTURE progression. Returns (target_scene_id, character_id)."""
    project = Project(title="Prog kontextus")
    db.add(project)
    await db.flush()
    book = Book(project_id=project.id, title="Könyv")
    db.add(book)
    await db.flush()
    ch = Chapter(book_id=book.id, title="Fejezet", order_index=0)
    db.add(ch)
    await db.flush()
    s0 = Scene(chapter_id=ch.id, title="Jelenet 0", order_index=0, content="x")
    s1 = Scene(chapter_id=ch.id, title="Jelenet 1", order_index=1, content="x")
    db.add_all([s0, s1])
    await db.flush()
    char = Character(project_id=project.id, name="Aragorn")
    db.add(char)
    await db.flush()
    db.add_all(
        [
            CodexProgression(
                entity_type="character", entity_id=char.id, scene_id=s0.id, note=PAST_STATE
            ),
            CodexProgression(
                entity_type="character", entity_id=char.id, scene_id=s1.id, note=FUTURE_STATE
            ),
        ]
    )
    await db.commit()
    return s0.id, char.id


@pytest.mark.integration
async def test_progression_state_injected_into_prompt(db_session):
    scene_id, char_id = await _make_scene_with_progressions(db_session)
    router = _capturing_router()
    svc = AIService(
        router=router,
        loader=prompt_loader,
        svc=revision_service,
        embeddings=_embeddings_returning_character(char_id),
    )
    await svc.rewrite(
        db_session,
        selected_text="Eredeti.",
        instruction="Javítsd",
        scene_id=scene_id,
        model="ollama/llama3.2",
    )
    user_msg = router.complete.call_args.kwargs["messages"][1]["content"]
    # The PAST state (current as of S=s0) is present; the FUTURE one is not.
    assert PAST_STATE in user_msg
    assert FUTURE_STATE not in user_msg


@pytest.mark.integration
async def test_no_progression_does_not_break_context(db_session):
    """An entity with no progressions still renders its normal snippet, no crash."""
    project = Project(title="Nincs progresszió")
    db_session.add(project)
    await db_session.flush()
    book = Book(project_id=project.id, title="Könyv")
    db_session.add(book)
    await db_session.flush()
    ch = Chapter(book_id=book.id, title="Fejezet", order_index=0)
    db_session.add(ch)
    await db_session.flush()
    s0 = Scene(chapter_id=ch.id, title="Jelenet", order_index=0, content="x")
    db_session.add(s0)
    await db_session.flush()
    char = Character(project_id=project.id, name="Aragorn")
    db_session.add(char)
    await db_session.commit()

    router = _capturing_router()
    svc = AIService(
        router=router,
        loader=prompt_loader,
        svc=revision_service,
        embeddings=_embeddings_returning_character(char.id),
    )
    rev, _job, entities = await svc.rewrite(
        db_session,
        selected_text="Eredeti.",
        instruction="Javítsd",
        scene_id=s0.id,
        model="ollama/llama3.2",
    )
    assert rev is not None
    user_msg = router.complete.call_args.kwargs["messages"][1]["content"]
    assert "Aragorn" in user_msg
    assert len(entities) == 1
    # With NO progression for this entity, the prompt must carry NO progression
    # annotation at all — a stale/default-state injection (the "(állapot a
    # jelenetig: …)" marker) must not leak. A source path that emits a default
    # marker when there is no progression fails here.
    assert "állapot a jelenetig" not in user_msg
