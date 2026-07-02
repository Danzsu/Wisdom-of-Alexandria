"""Brainstorm / expand / compress — the Sudowrite-style V1 writing ops.

Service level (mirrors test_rag_integration.py / test_research.py): the REAL
PromptLoader renders the real brainstorm/expand/compress templates, so the
{topic}/{selected_text}/{guidance}/{context}/{count} placeholders are genuinely
exercised; only the LLM call (router.complete) + the embedding layer are
controlled.

  * brainstorm: ideas parsed (tiered JSON → line-split → single fallback idea),
    GenerationJob(job_type="brainstorm") provenance, NO Revision (ideas are not
    manuscript text), RAG degradation, empty-topic short-circuit, loud failure.
  * expand / compress: HITL like rewrite — Revision(approved=False,
    revision_type="expand"/"compress") linked to the job + scene, RAG context
    injected, loud failure fails the job.

Endpoint level: POST /ai/brainstorm | /ai/expand | /ai/compress contracts
(200 happy path, input caps → 422, auth → 401, sanitized 502).
"""

import logging
import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.generation_job import GenerationJob, JobStatus
from alexandria_core.models.project import Project
from alexandria_core.models.revision import Revision
from alexandria_core.models.scene import Scene
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.ai import get_ai_service
from app.main import app
from app.services.ai_service import AIService
from app.services.embedding_service import EmbeddingService, RetrievedItem
from app.services.model_router import ModelResponse, ModelRouter
from app.services.prompt_loader import prompt_loader
from app.services.revision_service import revision_service

pytestmark = pytest.mark.integration

SNIPPET = "KODEX-JELZO: az ősi kard a hegy gyomrában pihen."
ENTITY_ID = uuid.uuid4()
IDEAS_JSON = '["Ötlet egy", "Ötlet kettő", "Ötlet három"]'


def _capturing_router(content: str) -> ModelRouter:
    router = AsyncMock(spec=ModelRouter)
    router.build_messages.side_effect = lambda system, user: [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    router.complete.return_value = ModelResponse(
        content=content, model="ollama/llama3.2", usage={}
    )
    return router


def _embeddings_with_snippet() -> EmbeddingService:
    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = "openai/text-embedding-3-small"
    emb.sync_project.return_value = MagicMock()
    emb.retrieve.return_value = [
        RetrievedItem(
            entity_type="character",
            entity_id=ENTITY_ID,
            label="Aragorn",
            snippet=SNIPPET,
            distance=0.01,
        )
    ]
    return emb


def _embeddings_no_provider() -> EmbeddingService:
    emb = AsyncMock(spec=EmbeddingService)
    emb.resolve_embedding_model.return_value = None
    return emb


def _service(router: ModelRouter, embeddings: EmbeddingService) -> AIService:
    return AIService(
        router=router, loader=prompt_loader, svc=revision_service, embeddings=embeddings
    )


async def _make_scene(db: AsyncSession) -> uuid.UUID:
    project = Project(title="Writing ops projekt")
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
    return scene.id


async def _revision_count(db: AsyncSession, job_id: uuid.UUID) -> int:
    return (
        await db.execute(
            select(func.count(Revision.id)).where(Revision.job_id == job_id)
        )
    ).scalar_one()


# ── brainstorm: service level ────────────────────────────────────────────────


async def test_brainstorm_parses_json_ideas_and_creates_job_no_revision(db_session):
    scene_id = await _make_scene(db_session)
    router = _capturing_router(IDEAS_JSON)
    service = _service(router, _embeddings_with_snippet())

    ideas, job, context_entities = await service.brainstorm(
        db_session,
        topic="Milyen fordulat jöhet a fejezet végén?",
        scene_id=scene_id,
        count=3,
        model="ollama/llama3.2",
    )

    assert ideas == ["Ötlet egy", "Ötlet kettő", "Ötlet három"]
    # The rendered prompt contains the topic, the requested count and the
    # retrieved snippet — and no literal placeholder leaked.
    user_msg = router.complete.call_args.kwargs["messages"][1]["content"]
    assert "Milyen fordulat jöhet a fejezet végén?" in user_msg
    assert "3" in user_msg
    assert SNIPPET in user_msg
    assert "{topic}" not in user_msg
    assert "{count}" not in user_msg
    assert "{context}" not in user_msg
    assert len(context_entities) == 1
    # Provenance: a completed brainstorm job linked to the scene…
    assert job is not None
    assert job.job_type == "brainstorm"
    assert job.scene_id == scene_id
    assert job.status == JobStatus.DONE
    # …and NO Revision — ideas are not manuscript text (nothing to approve).
    assert await _revision_count(db_session, job.id) == 0


async def test_brainstorm_plain_lines_fallback_parses(db_session):
    scene_id = await _make_scene(db_session)
    router = _capturing_router("- Az áruló a mester.\n- A kard hamisítvány.")
    service = _service(router, _embeddings_no_provider())

    ideas, job, _ = await service.brainstorm(
        db_session, topic="Fordulatok?", scene_id=scene_id, model="ollama/llama3.2"
    )

    assert ideas == ["Az áruló a mester.", "A kard hamisítvány."]
    assert job.status == JobStatus.DONE


async def test_brainstorm_truncates_ideas_to_count(db_session):
    router = _capturing_router('["a", "b", "c", "d", "e", "f"]')
    service = _service(router, _embeddings_no_provider())

    ideas, _job, _ = await service.brainstorm(
        db_session, topic="Ötletek?", count=2, model="ollama/llama3.2"
    )

    assert ideas == ["a", "b"]


async def test_brainstorm_garbage_degrades_to_single_fallback_idea(db_session, caplog):
    """An unusable (whitespace-only) model response degrades to ONE visible
    fallback idea + a logged WARNING — never a crash, never a silent empty list.
    The job still completes (the call succeeded; the output was unusable)."""
    scene_id = await _make_scene(db_session)
    router = _capturing_router("   \n  ")
    service = _service(router, _embeddings_no_provider())

    with caplog.at_level(logging.WARNING, logger="app.services.ai_service"):
        ideas, job, _ = await service.brainstorm(
            db_session, topic="Fordulatok?", scene_id=scene_id, model="ollama/llama3.2"
        )

    assert len(ideas) == 1
    assert "nem volt feldolgozható" in ideas[0]
    assert job.status == JobStatus.DONE
    assert any(
        r.levelno == logging.WARNING and "Brainstorm" in r.getMessage()
        for r in caplog.records
    )


async def test_brainstorm_no_provider_still_works(db_session):
    """RAG unconfigured → ideas still produced with empty citations."""
    scene_id = await _make_scene(db_session)
    emb = _embeddings_no_provider()
    router = _capturing_router(IDEAS_JSON)
    service = _service(router, emb)

    ideas, _job, context_entities = await service.brainstorm(
        db_session, topic="Fordulatok?", scene_id=scene_id, model="ollama/llama3.2"
    )

    assert len(ideas) == 3
    assert context_entities == []
    emb.retrieve.assert_not_called()


async def test_brainstorm_empty_topic_short_circuits(db_session):
    router = _capturing_router(IDEAS_JSON)
    service = _service(router, _embeddings_no_provider())

    ideas, job, context_entities = await service.brainstorm(
        db_session, topic="   ", model="ollama/llama3.2"
    )

    assert ideas == []
    assert job is None
    assert context_entities == []
    router.complete.assert_not_called()


async def test_brainstorm_llm_failure_fails_job_and_raises(db_session):
    scene_id = await _make_scene(db_session)
    router = _capturing_router(IDEAS_JSON)
    router.complete.side_effect = RuntimeError("LLM unreachable")
    service = _service(router, _embeddings_no_provider())

    with pytest.raises(RuntimeError):
        await service.brainstorm(
            db_session, topic="Fordulatok?", scene_id=scene_id, model="ollama/llama3.2"
        )

    job = (
        await db_session.execute(
            select(GenerationJob).where(GenerationJob.job_type == "brainstorm")
        )
    ).scalar_one()
    assert job.status == JobStatus.FAILED


# ── expand / compress: service level ─────────────────────────────────────────


async def test_expand_creates_unapproved_expand_revision(db_session):
    scene_id = await _make_scene(db_session)
    router = _capturing_router("Kibővített, érzékletes szöveg.")
    service = _service(router, _embeddings_with_snippet())

    revision, job, context_entities = await service.expand(
        db_session,
        selected_text="A hős belépett.",
        guidance="Több érzékszervi részlet.",
        scene_id=scene_id,
        model="ollama/llama3.2",
    )

    # HITL: an unapproved expand revision linked to the scene + job.
    assert revision.approved is False
    assert revision.revision_type == "expand"
    assert revision.scene_id == scene_id
    assert revision.job_id == job.id
    assert revision.content == "Kibővített, érzékletes szöveg."
    assert job.job_type == "expand"
    assert job.status == JobStatus.DONE
    # The rendered prompt contains the selection, the guidance and the snippet.
    user_msg = router.complete.call_args.kwargs["messages"][1]["content"]
    assert "A hős belépett." in user_msg
    assert "Több érzékszervi részlet." in user_msg
    assert SNIPPET in user_msg
    assert "{selected_text}" not in user_msg
    assert "{guidance}" not in user_msg
    assert "{context}" not in user_msg
    assert len(context_entities) == 1


async def test_compress_creates_unapproved_compress_revision(db_session):
    scene_id = await _make_scene(db_session)
    router = _capturing_router("Tömör szöveg.")
    service = _service(router, _embeddings_with_snippet())

    revision, job, context_entities = await service.compress(
        db_session,
        selected_text="A hős nagyon-nagyon lassan és igen körülményesen belépett.",
        scene_id=scene_id,
        model="ollama/llama3.2",
    )

    assert revision.approved is False
    assert revision.revision_type == "compress"
    assert revision.scene_id == scene_id
    assert revision.job_id == job.id
    assert job.job_type == "compress"
    assert job.status == JobStatus.DONE
    user_msg = router.complete.call_args.kwargs["messages"][1]["content"]
    assert "körülményesen belépett" in user_msg
    assert SNIPPET in user_msg
    assert "{selected_text}" not in user_msg
    assert len(context_entities) == 1


@pytest.mark.parametrize("method", ["expand", "compress"])
async def test_expand_compress_no_provider_still_works(db_session, method):
    """RAG unconfigured → the transformation still runs (empty context)."""
    scene_id = await _make_scene(db_session)
    emb = _embeddings_no_provider()
    router = _capturing_router("Átalakított szöveg.")
    service = _service(router, emb)

    revision, _job, context_entities = await getattr(service, method)(
        db_session, selected_text="Eredeti.", scene_id=scene_id, model="ollama/llama3.2"
    )

    assert revision.revision_type == method
    assert context_entities == []
    emb.retrieve.assert_not_called()


@pytest.mark.parametrize("method", ["expand", "compress"])
async def test_expand_compress_llm_failure_fails_job_and_raises(db_session, method):
    scene_id = await _make_scene(db_session)
    router = _capturing_router("x")
    router.complete.side_effect = RuntimeError("LLM unreachable")
    service = _service(router, _embeddings_no_provider())

    with pytest.raises(RuntimeError):
        await getattr(service, method)(
            db_session, selected_text="Eredeti.", scene_id=scene_id, model="ollama/llama3.2"
        )

    job = (
        await db_session.execute(
            select(GenerationJob).where(GenerationJob.job_type == method)
        )
    ).scalar_one()
    assert job.status == JobStatus.FAILED


# ── endpoint level ───────────────────────────────────────────────────────────


def _mock_revision(revision_type: str) -> Revision:
    rev = Revision(
        content="Generált szöveg.",
        revision_type=revision_type,
        approved=False,
        model_name="ollama/llama3.2",
        prompt_version="1.0",
    )
    rev.id = uuid.uuid4()
    rev.created_at = datetime.now(UTC)
    rev.updated_at = datetime.now(UTC)
    return rev


def _mock_job(job_type: str) -> GenerationJob:
    job = GenerationJob(
        job_type=job_type,
        status=JobStatus.DONE,
        model_name="ollama/llama3.2",
        prompt_version="1.0",
    )
    job.id = uuid.uuid4()
    job.created_at = datetime.now(UTC)
    job.updated_at = datetime.now(UTC)
    return job


@pytest.fixture
def mock_writing_svc():
    svc = AsyncMock(spec=AIService)
    svc.brainstorm.return_value = (
        ["Ötlet A", "Ötlet B"],
        _mock_job("brainstorm"),
        [{"id": str(uuid.uuid4()), "label": "Aragorn", "entity_type": "character"}],
    )
    svc.expand.return_value = (_mock_revision("expand"), _mock_job("expand"), [])
    svc.compress.return_value = (_mock_revision("compress"), _mock_job("compress"), [])
    app.dependency_overrides[get_ai_service] = lambda: svc
    yield svc
    app.dependency_overrides.pop(get_ai_service, None)


async def test_brainstorm_endpoint_returns_ideas_job_and_chips(
    client: AsyncClient, auth_headers: dict, mock_writing_svc
):
    resp = await client.post(
        "/api/v1/ai/brainstorm",
        json={"topic": "Milyen fordulat jöhet?", "count": 4},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ideas"] == ["Ötlet A", "Ötlet B"]
    assert data["job"]["job_type"] == "brainstorm"
    assert len(data["context_entities"]) == 1
    # NO revision in the brainstorm contract — ideas are not manuscript text.
    assert "revision" not in data
    kwargs = mock_writing_svc.brainstorm.call_args.kwargs
    assert kwargs["topic"] == "Milyen fordulat jöhet?"
    assert kwargs["count"] == 4


async def test_brainstorm_endpoint_defaults_count_to_5(
    client: AsyncClient, auth_headers: dict, mock_writing_svc
):
    resp = await client.post(
        "/api/v1/ai/brainstorm", json={"topic": "Ötletek?"}, headers=auth_headers
    )
    assert resp.status_code == 200
    assert mock_writing_svc.brainstorm.call_args.kwargs["count"] == 5


async def test_brainstorm_endpoint_null_job_serializes(
    client: AsyncClient, auth_headers: dict, mock_writing_svc
):
    """The empty-topic short-circuit contract: no job → job serializes as null."""
    mock_writing_svc.brainstorm.return_value = ([], None, [])
    resp = await client.post(
        "/api/v1/ai/brainstorm", json={"topic": "x"}, headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ideas"] == []
    assert data["job"] is None


async def test_brainstorm_endpoint_over_cap_topic_is_422(
    client: AsyncClient, auth_headers: dict, mock_writing_svc
):
    resp = await client.post(
        "/api/v1/ai/brainstorm",
        json={"topic": "x" * 8001},
        headers=auth_headers,
    )
    assert resp.status_code == 422
    mock_writing_svc.brainstorm.assert_not_called()


@pytest.mark.parametrize("count", [0, 11])
async def test_brainstorm_endpoint_out_of_range_count_is_422(
    client: AsyncClient, auth_headers: dict, mock_writing_svc, count
):
    resp = await client.post(
        "/api/v1/ai/brainstorm",
        json={"topic": "Ötletek?", "count": count},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_brainstorm_endpoint_forwards_generation_params(
    client: AsyncClient, auth_headers: dict, mock_writing_svc
):
    resp = await client.post(
        "/api/v1/ai/brainstorm",
        json={"topic": "Ötletek?", "temperature": 1.1, "max_tokens": 900},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    kwargs = mock_writing_svc.brainstorm.call_args.kwargs
    assert kwargs["temperature"] == 1.1
    assert kwargs["max_tokens"] == 900


@pytest.mark.parametrize(
    ("url", "body"),
    [
        ("/api/v1/ai/expand", {"selected_text": "A hős belépett."}),
        ("/api/v1/ai/compress", {"selected_text": "A hős belépett."}),
    ],
)
async def test_expand_compress_endpoints_return_unapproved_revision(
    client: AsyncClient, auth_headers: dict, mock_writing_svc, url, body
):
    resp = await client.post(url, json=body, headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    expected_type = url.rsplit("/", 1)[-1]
    assert data["revision"]["approved"] is False
    assert data["revision"]["revision_type"] == expected_type
    assert data["job"]["job_type"] == expected_type
    getattr(mock_writing_svc, expected_type).assert_called_once()


async def test_expand_endpoint_forwards_guidance_and_scene(
    client: AsyncClient, auth_headers: dict, mock_writing_svc
):
    scene_id = str(uuid.uuid4())
    resp = await client.post(
        "/api/v1/ai/expand",
        json={
            "selected_text": "A hős belépett.",
            "guidance": "Több belső monológ.",
            "scene_id": scene_id,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 200
    kwargs = mock_writing_svc.expand.call_args.kwargs
    assert kwargs["selected_text"] == "A hős belépett."
    assert kwargs["guidance"] == "Több belső monológ."
    assert kwargs["scene_id"] == uuid.UUID(scene_id)


@pytest.mark.parametrize("url", ["/api/v1/ai/expand", "/api/v1/ai/compress"])
async def test_expand_compress_over_cap_selected_text_is_422(
    client: AsyncClient, auth_headers: dict, mock_writing_svc, url
):
    from app.api.v1.ai import _TEXT_MAX_CHARS

    resp = await client.post(
        url,
        json={"selected_text": "x" * (_TEXT_MAX_CHARS + 1)},
        headers=auth_headers,
    )
    assert resp.status_code == 422


@pytest.mark.parametrize(
    ("url", "body"),
    [
        ("/api/v1/ai/brainstorm", {"topic": "x"}),
        ("/api/v1/ai/expand", {"selected_text": "x"}),
        ("/api/v1/ai/compress", {"selected_text": "x"}),
    ],
)
async def test_writing_ops_require_auth(
    client: AsyncClient, mock_writing_svc, url, body
):
    resp = await client.post(url, json=body)
    assert resp.status_code == 401


@pytest.mark.parametrize(
    ("url", "body", "method"),
    [
        ("/api/v1/ai/brainstorm", {"topic": "x"}, "brainstorm"),
        ("/api/v1/ai/expand", {"selected_text": "x"}, "expand"),
        ("/api/v1/ai/compress", {"selected_text": "x"}, "compress"),
    ],
)
async def test_writing_ops_errors_are_sanitized_502(
    client: AsyncClient, auth_headers: dict, mock_writing_svc, url, body, method
):
    getattr(mock_writing_svc, method).side_effect = Exception("boom\nSECRET-leak")
    resp = await client.post(url, json=body, headers=auth_headers)
    assert resp.status_code == 502
    detail = resp.json()["detail"]
    assert detail.startswith("AI generation failed: ")
    assert "\n" not in detail
