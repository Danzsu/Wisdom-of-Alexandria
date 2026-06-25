"""Unit tests for AIService.check_continuity (B3).

A continuity check is ANALYSIS, not generated content: it creates a
GenerationJob(job_type="continuity") but NO Revision, and returns a list of
structured warnings parsed ROBUSTLY from the model output. The parse must never
silently swallow — an unparseable response degrades to a single visible warning
(+ a logged WARNING), while a real LLM/infra error still fail_job's + re-raises.
"""

import json
import logging
import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from alexandria_core.models.generation_job import GenerationJob, JobStatus
from alexandria_core.models.revision import Revision

from app.services.ai_service import AIService
from app.services.embedding_service import EmbeddingService
from app.services.model_router import ModelResponse, ModelRouter
from app.services.prompt_loader import PromptLoader
from app.services.revision_service import RevisionService


def _make_mock_router(content="[]"):
    router = AsyncMock(spec=ModelRouter)
    router.build_messages.return_value = [{"role": "user", "content": "test"}]
    router.complete.return_value = ModelResponse(
        content=content,
        model="ollama/llama3.2",
        usage={"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
    )
    return router


def _make_mock_loader():
    loader = MagicMock(spec=PromptLoader)
    loader.load_system.return_value = "System prompt"
    loader.load_user.return_value = "User prompt"
    return loader


def _make_mock_svc():
    svc = AsyncMock(spec=RevisionService)
    svc.create_job.return_value = GenerationJob(
        job_type="continuity", status=JobStatus.RUNNING
    )
    svc.complete_job.return_value = GenerationJob(
        job_type="continuity", status=JobStatus.DONE
    )
    return svc


def _make_embeddings(snippet: str | None = None):
    """Embeddings stub. By default RAG is UNCONFIGURED (no model) so continuity
    runs on the scene text alone. Pass a snippet to simulate retrieved context."""
    emb = AsyncMock(spec=EmbeddingService)
    if snippet is None:
        emb.resolve_embedding_model.return_value = None
    else:
        from app.services.embedding_service import RetrievedItem

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


@pytest.fixture
def mock_db():
    db = AsyncMock()
    return db


def _service(router=None, loader=None, svc=None, emb=None):
    return AIService(
        router=router or _make_mock_router(),
        loader=loader or _make_mock_loader(),
        svc=svc or _make_mock_svc(),
        embeddings=emb or _make_embeddings(),
    )


def _patch_resolve(service, project_id, scene_content="A jelenet szövege."):
    """Patch the scope-resolution + scene-content loaders so the service runs
    without a real DB (mock_db). Returns the patched service.

    ``_rag_context`` resolves ``(project_id, active_series_id)`` via
    ``_resolve_scope`` in one query — patch that (no series here → active series
    None). ``_resolve_project_id`` is also patched for any direct callers.
    """
    service._resolve_scope = AsyncMock(return_value=(project_id, None))
    service._resolve_project_id = AsyncMock(return_value=project_id)
    service._load_scene_content = AsyncMock(return_value=scene_content)
    # Progression "state as of S" annotation also touches the DB; stub it out so
    # these unit tests run against the mock_db without hitting the real query
    # (its behaviour is covered by the integration tests). Default: no notes.
    service._progression_notes = AsyncMock(return_value={})
    return service


# ── happy path: structured JSON parsed into warnings ───────────────────────────


async def test_check_continuity_parses_json_array(mock_db):
    warnings_json = json.dumps(
        [
            {"severity": "error", "message": "Marcus meghalt, mégis itt van.", "entity": "Marcus"},
            {"severity": "warning", "message": "Napszak-ellentmondás.", "entity": None},
        ]
    )
    svc_obj = _make_mock_svc()
    service = _service(router=_make_mock_router(warnings_json), svc=svc_obj)
    _patch_resolve(service, uuid.uuid4())

    warnings, job, context_entities = await service.check_continuity(
        mock_db, scene_id=uuid.uuid4()
    )
    assert len(warnings) == 2
    assert warnings[0]["severity"] == "error"
    assert warnings[0]["entity"] == "Marcus"
    assert warnings[1]["entity"] is None
    # Job created + completed with the warning count; NO revision saved.
    svc_obj.create_job.assert_called_once()
    assert svc_obj.create_job.call_args.kwargs["job_type"] == "continuity"
    svc_obj.complete_job.assert_called_once()
    assert svc_obj.complete_job.call_args.kwargs["output_data"] == {"warning_count": 2}
    assert not hasattr(svc_obj, "save_revision") or not svc_obj.save_revision.called


async def test_check_continuity_empty_array_means_no_issues(mock_db):
    service = _service(router=_make_mock_router("[]"))
    _patch_resolve(service, uuid.uuid4())
    warnings, _job, _ce = await service.check_continuity(mock_db, scene_id=uuid.uuid4())
    assert warnings == []


async def test_check_continuity_never_saves_revision(mock_db):
    """A continuity check is analysis — it must NOT create a Revision."""
    svc_obj = _make_mock_svc()
    # Give the mock a save_revision so we can assert it is NEVER called.
    svc_obj.save_revision = AsyncMock(
        return_value=Revision(content="x", revision_type="x", approved=False)
    )
    service = _service(router=_make_mock_router("[]"), svc=svc_obj)
    _patch_resolve(service, uuid.uuid4())
    await service.check_continuity(mock_db, scene_id=uuid.uuid4())
    svc_obj.save_revision.assert_not_called()


# ── parse robustness: tier 2 (regex extraction) ────────────────────────────────


async def test_check_continuity_extracts_array_from_chatty_response(mock_db):
    """Tier 2: the model wraps the array in prose / a code fence — a lenient
    regex still recovers the JSON array (NOT a degraded warning)."""
    chatty = (
        "Természetesen! Íme a talált problémák:\n```json\n"
        '[{"severity": "info", "message": "Apró eltérés a névírásban.", "entity": "Léné"}]\n'
        "```\nRemélem segítettem!"
    )
    service = _service(router=_make_mock_router(chatty))
    _patch_resolve(service, uuid.uuid4())
    warnings, _job, _ce = await service.check_continuity(mock_db, scene_id=uuid.uuid4())
    assert len(warnings) == 1
    assert warnings[0]["severity"] == "info"
    assert warnings[0]["message"] == "Apró eltérés a névírásban."


# ── parse robustness: tier 3 (graceful degradation, NOT a crash/silent empty) ──


async def test_check_continuity_unparseable_degrades_to_warning(mock_db, caplog):
    """Tier 3: a totally unparseable response degrades to ONE visible warning
    (+ a logged WARNING) — never a crash, never a silently-swallowed empty."""
    svc_obj = _make_mock_svc()
    service = _service(
        router=_make_mock_router("Nem találtam semmilyen problémát a szövegben."),
        svc=svc_obj,
    )
    _patch_resolve(service, uuid.uuid4())

    with caplog.at_level(logging.WARNING, logger="app.services.ai_service"):
        warnings, _job, _ce = await service.check_continuity(
            mock_db, scene_id=uuid.uuid4()
        )
    # Degraded — exactly one warning describing the parse failure (NOT empty).
    assert len(warnings) == 1
    assert warnings[0]["severity"] == "warning"
    assert warnings[0]["message"]  # non-empty, human-readable
    # The job still completes (the analysis "ran", it just couldn't be parsed).
    svc_obj.complete_job.assert_called_once()
    # The degradation was LOGGED at WARNING — never silently swallowed.
    assert any(r.levelno == logging.WARNING for r in caplog.records)


async def test_check_continuity_non_array_json_degrades(mock_db):
    """A valid-JSON-but-not-an-array response (e.g. an object) also degrades to a
    single warning rather than crashing or returning empty."""
    service = _service(router=_make_mock_router('{"oops": "not an array"}'))
    _patch_resolve(service, uuid.uuid4())
    warnings, _job, _ce = await service.check_continuity(mock_db, scene_id=uuid.uuid4())
    assert len(warnings) == 1
    assert warnings[0]["severity"] == "warning"


# ── validation / clamping of individual warnings ───────────────────────────────


async def test_check_continuity_clamps_invalid_severity(mock_db):
    """A warning with an out-of-range severity is clamped to 'warning', not dropped."""
    bad = json.dumps([{"severity": "catastrophic", "message": "Hiba.", "entity": None}])
    service = _service(router=_make_mock_router(bad))
    _patch_resolve(service, uuid.uuid4())
    warnings, _job, _ce = await service.check_continuity(mock_db, scene_id=uuid.uuid4())
    assert len(warnings) == 1
    assert warnings[0]["severity"] == "warning"


async def test_check_continuity_skips_warning_without_message(mock_db):
    """An item missing the required `message` is dropped (message is required);
    well-formed siblings still come through."""
    mixed = json.dumps(
        [
            {"severity": "error", "entity": "X"},  # no message → dropped
            {"severity": "info", "message": "Rendben lévő figyelmeztetés."},
        ]
    )
    service = _service(router=_make_mock_router(mixed))
    _patch_resolve(service, uuid.uuid4())
    warnings, _job, _ce = await service.check_continuity(mock_db, scene_id=uuid.uuid4())
    assert len(warnings) == 1
    assert warnings[0]["message"] == "Rendben lévő figyelmeztetés."


async def test_check_continuity_entity_defaults_to_none(mock_db):
    """A warning with no `entity` field gets entity=None (entity is optional)."""
    data = json.dumps([{"severity": "warning", "message": "Nincs entitás."}])
    service = _service(router=_make_mock_router(data))
    _patch_resolve(service, uuid.uuid4())
    warnings, _job, _ce = await service.check_continuity(mock_db, scene_id=uuid.uuid4())
    assert warnings[0]["entity"] is None


# ── no provider → continuity STILL runs on the scene text alone ────────────────


async def test_check_continuity_runs_with_no_embedding_provider(mock_db):
    """RAG unconfigured (no embedding model): the check still runs on the scene
    text — empty codex context, no embed call, no crash."""
    emb = _make_embeddings(snippet=None)  # resolve_embedding_model → None
    router = _make_mock_router("[]")
    service = _service(router=router, emb=emb)
    _patch_resolve(service, uuid.uuid4(), scene_content="A jelenet szövege.")
    warnings, _job, context_entities = await service.check_continuity(
        mock_db, scene_id=uuid.uuid4()
    )
    assert warnings == []
    assert context_entities == []
    emb.retrieve.assert_not_called()
    router.complete.assert_called_once()


async def test_check_continuity_injects_codex_context_when_available(mock_db):
    """When RAG is configured, the retrieved snippet is injected into the prompt
    and the entity flows back through context_entities."""
    snippet = "EGYEDI-JELZO: Szelene a Nagykönyvtár írnoka."
    emb = _make_embeddings(snippet=snippet)
    loader = _make_mock_loader()
    service = _service(loader=loader, emb=emb)
    _patch_resolve(service, uuid.uuid4())
    _warnings, _job, context_entities = await service.check_continuity(
        mock_db, scene_id=uuid.uuid4()
    )
    # The codex_context kwarg handed to load_user carries the retrieved snippet.
    assert snippet in loader.load_user.call_args.kwargs["codex_context"]
    assert len(context_entities) == 1
    assert context_entities[0]["label"] == "Szelene"


# ── real LLM/infra error → fail_job + re-raise (NOT masked by parse fallback) ──


async def test_check_continuity_fails_job_on_llm_error(mock_db):
    """A real router.complete error must fail_job + re-raise — the parse fallback
    must NOT mask an infra failure as a 'couldn't parse' warning."""
    router = _make_mock_router()
    router.complete.side_effect = Exception("LLM unreachable")
    svc_obj = _make_mock_svc()
    service = _service(router=router, svc=svc_obj)
    _patch_resolve(service, uuid.uuid4())

    with pytest.raises(Exception, match="LLM unreachable"):
        await service.check_continuity(mock_db, scene_id=uuid.uuid4())
    mock_db.rollback.assert_awaited_once()
    svc_obj.fail_job.assert_called_once()
    svc_obj.complete_job.assert_not_called()


async def test_check_continuity_fail_job_message_sanitized(mock_db):
    """The error_message handed to fail_job is bounded + single-line (no leak)."""
    router = _make_mock_router()
    raw = "secret-trace\nline2\n" + ("x" * 5000)
    router.complete.side_effect = Exception(raw)
    svc_obj = _make_mock_svc()
    service = _service(router=router, svc=svc_obj)
    _patch_resolve(service, uuid.uuid4())

    with pytest.raises(Exception):
        await service.check_continuity(mock_db, scene_id=uuid.uuid4())
    msg = svc_obj.fail_job.call_args.kwargs["error_message"]
    assert "\n" not in msg
    assert len(msg) <= 300
