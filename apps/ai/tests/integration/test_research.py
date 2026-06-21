"""RAG Q&A (research) integration (P2).

Service level: exercises ``AIService.research`` against a real DB session — the
``{codex_context}``/``{question}`` placeholders of the REAL research.md template,
RAG context injection, the no-provider graceful degradation (answer still
produced), the empty-question short-circuit, the GenerationJob(job_type=
"research") provenance, and the loud-failure path. Endpoint level: the
``POST /ai/research`` contract (answer + citation chips, auth, sanitized 502).
Only the LLM call (router.complete) + the embedding layer are controlled.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from alexandria_core.models.generation_job import GenerationJob, JobStatus
from alexandria_core.models.project import Project
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.ai import get_ai_service
from app.main import app
from app.services.ai_service import AIService
from app.services.embedding_service import EmbeddingService, RetrievedItem
from app.services.model_router import ModelResponse, ModelRouter
from app.services.prompt_loader import prompt_loader
from app.services.revision_service import revision_service

ANSWER = "Szelene a Nagykönyvtár éjszakai írnoka."


def _capturing_router(content: str = ANSWER) -> ModelRouter:
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
    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = "openai/text-embedding-3-small"
    emb.sync_project.return_value = MagicMock()
    emb.retrieve.return_value = [
        RetrievedItem(
            entity_type="codex",
            entity_id=uuid.uuid4(),
            label="Szelene",
            snippet=snippet,
            distance=0.01,
        )
    ]
    return emb


def _service(router: ModelRouter, embeddings: EmbeddingService) -> AIService:
    return AIService(
        router=router, loader=prompt_loader, svc=revision_service, embeddings=embeddings
    )


async def _make_project(db: AsyncSession) -> uuid.UUID:
    project = Project(title="Kutatás projekt")
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project.id


# ── service level ───────────────────────────────────────────────────────────


@pytest.mark.integration
async def test_research_injects_codex_context_and_returns_answer(db_session):
    project_id = await _make_project(db_session)
    snippet = "KODEX-JELZO: Szelene a Nagykönyvtár éjszakai írnoka."
    router = _capturing_router(ANSWER)
    service = _service(router, _embeddings_with(snippet))

    answer, job, context_entities = await service.research(
        db_session, question="Ki Szelene?", project_id=project_id, model="ollama/llama3.2"
    )

    assert answer == ANSWER
    user_msg = router.complete.call_args.kwargs["messages"][1]["content"]
    assert snippet in user_msg  # the retrieved context reached the prompt
    assert "Ki Szelene?" in user_msg  # the question reached the prompt
    # The real template must not leak literal placeholders.
    assert "{codex_context}" not in user_msg
    assert "{question}" not in user_msg
    assert len(context_entities) == 1  # citation chip
    # Provenance: a project-scoped research job, completed (never a Revision).
    assert job is not None
    assert job.job_type == "research"
    assert job.project_id == project_id
    assert job.status == JobStatus.DONE


@pytest.mark.integration
async def test_research_no_provider_still_answers_with_empty_context(db_session):
    """RAG unconfigured → the model still answers (from the question alone) with
    empty citations — graceful degradation, not a 500."""
    project_id = await _make_project(db_session)
    router = _capturing_router(ANSWER)
    service = _service(router, _embeddings_no_provider())

    answer, _job, context_entities = await service.research(
        db_session, question="Ki Szelene?", project_id=project_id, model="ollama/llama3.2"
    )

    assert answer == ANSWER
    assert context_entities == []
    router.complete.assert_called_once()  # the model still ran


@pytest.mark.integration
async def test_research_empty_question_short_circuits(db_session):
    """An empty/whitespace question → empty answer, no job, NO LLM call."""
    project_id = await _make_project(db_session)
    router = _capturing_router()
    service = _service(router, _embeddings_no_provider())

    answer, job, context_entities = await service.research(
        db_session, question="   ", project_id=project_id, model="ollama/llama3.2"
    )

    assert answer == ""
    assert job is None
    assert context_entities == []
    router.complete.assert_not_called()


@pytest.mark.integration
async def test_research_llm_failure_fails_job_and_raises(db_session):
    """A real LLM/infra error fails the job + re-raises (loud, not swallowed)."""
    project_id = await _make_project(db_session)
    router = _capturing_router()
    router.complete.side_effect = RuntimeError("LLM unreachable")
    service = _service(router, _embeddings_no_provider())

    with pytest.raises(RuntimeError):
        await service.research(
            db_session,
            question="Ki Szelene?",
            project_id=project_id,
            model="ollama/llama3.2",
        )

    job = (
        await db_session.execute(
            select(GenerationJob).where(
                GenerationJob.project_id == project_id,
                GenerationJob.job_type == "research",
            )
        )
    ).scalar_one()
    assert job.status == JobStatus.FAILED


# ── endpoint level ──────────────────────────────────────────────────────────


@pytest.fixture
def mock_research_svc():
    svc = AsyncMock(spec=AIService)
    svc.research.return_value = (
        ANSWER,
        None,
        [{"id": str(uuid.uuid4()), "label": "Szelene", "entity_type": "codex"}],
    )
    app.dependency_overrides[get_ai_service] = lambda: svc
    yield svc
    app.dependency_overrides.pop(get_ai_service, None)


@pytest.mark.integration
async def test_research_endpoint_returns_answer_and_chips(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession, mock_research_svc
):
    project_id = await _make_project(db_session)
    resp = await client.post(
        "/api/v1/ai/research",
        json={"question": "Ki Szelene?", "project_id": str(project_id)},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["answer"] == ANSWER
    assert len(data["context_entities"]) == 1
    assert data["context_entities"][0]["entity_type"] == "codex"
    mock_research_svc.research.assert_called_once()


@pytest.mark.integration
async def test_research_endpoint_requires_auth(client: AsyncClient):
    resp = await client.post(
        "/api/v1/ai/research",
        json={"question": "x", "project_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 401


@pytest.mark.integration
async def test_research_endpoint_nonexistent_project_is_422(
    client: AsyncClient, auth_headers: dict, mock_research_svc
):
    """A bogus project_id must be a clean 422 (validated before the job), never an
    opaque 502 from a FK violation, and the service is never invoked."""
    resp = await client.post(
        "/api/v1/ai/research",
        json={"question": "Ki Szelene?", "project_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    mock_research_svc.research.assert_not_called()


@pytest.mark.integration
async def test_research_endpoint_error_is_sanitized_502(
    client: AsyncClient, auth_headers: dict, db_session: AsyncSession, mock_research_svc
):
    project_id = await _make_project(db_session)
    mock_research_svc.research.side_effect = Exception("boom\nSECRET-leak")
    resp = await client.post(
        "/api/v1/ai/research",
        json={"question": "Ki Szelene?", "project_id": str(project_id)},
        headers=auth_headers,
    )
    assert resp.status_code == 502
    assert "\n" not in resp.json()["detail"]  # single-line, sanitized
