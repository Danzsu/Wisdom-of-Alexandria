import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from alexandria_core.models.generation_job import GenerationJob, JobStatus
from alexandria_core.models.revision import Revision
from alexandria_core.models.scene import Scene

from app.services.ai_service import DESCRIBE_CHANNELS, AIService
from app.services.model_router import ModelResponse, ModelRouter
from app.services.prompt_loader import PromptLoader
from app.services.revision_service import RevisionService


def _make_mock_router(content="Generated text"):
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
    svc.create_job.return_value = GenerationJob(job_type="test", status=JobStatus.RUNNING)
    svc.save_revision.return_value = Revision(content="text", revision_type="test", approved=False)
    svc.complete_job.return_value = GenerationJob(job_type="test", status=JobStatus.DONE)
    return svc


@pytest.fixture
def mock_db():
    return AsyncMock()


@pytest.fixture
def ai(mock_db):
    return AIService(
        router=_make_mock_router(),
        loader=_make_mock_loader(),
        svc=_make_mock_svc(),
    )


async def test_rewrite_calls_model_router(mock_db):
    router = _make_mock_router("Átírt szöveg")
    loader = _make_mock_loader()
    svc = _make_mock_svc()
    service = AIService(router=router, loader=loader, svc=svc)

    revision, job, context_entities = await service.rewrite(
        mock_db,
        selected_text="Eredeti szöveg",
        instruction="Tedd poétikusabbá",
    )
    router.complete.assert_called_once()
    svc.save_revision.assert_called_once()
    assert revision is not None
    assert job is not None
    # No scene_id → RAG skipped → empty context entities.
    assert context_entities == []


async def test_rewrite_fails_job_on_exception(mock_db):
    router = _make_mock_router()
    loader = _make_mock_loader()
    svc = _make_mock_svc()
    router.complete.side_effect = Exception("LLM error")

    service = AIService(router=router, loader=loader, svc=svc)
    with pytest.raises(Exception, match="LLM error"):
        await service.rewrite(mock_db, selected_text="x", instruction="y")
    svc.fail_job.assert_called_once()


async def test_rewrite_rolls_back_before_failing_job(mock_db):
    """FIX 4: a clean session for fail_job's commit even on a DB-side error."""
    router = _make_mock_router()
    svc = _make_mock_svc()
    router.complete.side_effect = Exception("boom")

    service = AIService(router=router, loader=_make_mock_loader(), svc=svc)
    with pytest.raises(Exception, match="boom"):
        await service.rewrite(mock_db, selected_text="x", instruction="y")
    mock_db.rollback.assert_awaited_once()
    svc.fail_job.assert_called_once()


async def test_rewrite_fail_job_message_is_sanitized(mock_db):
    """FIX 2: the error_message handed to fail_job is bounded + single-line."""
    router = _make_mock_router()
    svc = _make_mock_svc()
    raw = "secret-trace\nline2\n" + ("x" * 5000)
    router.complete.side_effect = Exception(raw)

    service = AIService(router=router, loader=_make_mock_loader(), svc=svc)
    with pytest.raises(Exception):
        await service.rewrite(mock_db, selected_text="x", instruction="y")
    msg = svc.fail_job.call_args.kwargs["error_message"]
    assert "\n" not in msg
    assert len(msg) <= 300


async def test_rewrite_timeout_produces_clean_failure(mock_db):
    """FIX 3: an acompletion timeout flows to fail_job + re-raise, no hang."""
    import asyncio

    router = _make_mock_router()
    svc = _make_mock_svc()
    router.complete.side_effect = TimeoutError("timed out")

    service = AIService(router=router, loader=_make_mock_loader(), svc=svc)
    with pytest.raises(asyncio.TimeoutError):
        await service.rewrite(mock_db, selected_text="x", instruction="y")
    mock_db.rollback.assert_awaited_once()
    svc.fail_job.assert_called_once()


async def test_describe_generates_one_revision_per_channel(mock_db):
    router = _make_mock_router()
    loader = _make_mock_loader()
    svc = _make_mock_svc()
    service = AIService(router=router, loader=loader, svc=svc)

    revisions, job = await service.describe(
        mock_db,
        selected_text="Egy szoba leírása",
        channels=["Látás", "Hang"],
    )
    assert router.complete.call_count == 2
    assert svc.save_revision.call_count == 2


async def test_describe_all_6_channels_by_default(mock_db):
    router = _make_mock_router()
    loader = _make_mock_loader()
    svc = _make_mock_svc()
    service = AIService(router=router, loader=loader, svc=svc)

    revisions, job = await service.describe(mock_db, selected_text="Szöveg")
    assert router.complete.call_count == 6
    # Each channel must be generated EXACTLY ONCE with its OWN name — not the same
    # channel six times. Capture the channel kwarg of every load_user call and
    # assert it equals the canonical 6 distinct channels (source order). A
    # mutation generating channel="Látás" 6× fails here.
    channels_used = [c.kwargs["channel"] for c in loader.load_user.call_args_list]
    assert channels_used == DESCRIBE_CHANNELS
    assert len(set(channels_used)) == 6


async def test_describe_invalid_channel_raises(mock_db):
    service = AIService(router=_make_mock_router(), loader=_make_mock_loader(), svc=_make_mock_svc())
    with pytest.raises(ValueError, match="Invalid channels"):
        await service.describe(mock_db, selected_text="x", channels=["InvalidChannel"])


async def test_generate_scene_formats_beats(mock_db):
    router = _make_mock_router()
    loader = _make_mock_loader()
    svc = _make_mock_svc()
    service = AIService(router=router, loader=loader, svc=svc)

    await service.generate_scene(mock_db, beats=["A hős belép", "Meglátja az ellenfelet"])
    loader.load_user.assert_called_once()
    call_kwargs = loader.load_user.call_args.kwargs
    assert "A hős belép" in call_kwargs["beats"]
    assert "Meglátja az ellenfelet" in call_kwargs["beats"]


async def test_write_continue_passes_word_count(mock_db):
    router = _make_mock_router()
    loader = _make_mock_loader()
    svc = _make_mock_svc()
    service = AIService(router=router, loader=loader, svc=svc)

    await service.write_continue(mock_db, scene_text="Szöveg...", word_count_target=500)
    call_kwargs = loader.load_user.call_args.kwargs
    assert call_kwargs["word_count_target"] == "500"


async def test_summarize_passes_content_type(mock_db):
    router = _make_mock_router()
    loader = _make_mock_loader()
    svc = _make_mock_svc()
    service = AIService(router=router, loader=loader, svc=svc)

    await service.summarize(mock_db, content="Szöveg...", content_type="fejezet")
    call_kwargs = loader.load_user.call_args.kwargs
    assert call_kwargs["content_type"] == "fejezet"


async def test_singleton_exists():
    from app.services.ai_service import ai_service
    assert isinstance(ai_service, AIService)


# ── Generation parameters (P1.2) ───────────────────────────────────────────────
# temperature / max_tokens are optional overrides. When provided they must reach
# ModelRouter.complete with the exact values; when omitted the per-action default
# (or no override at all) must be preserved.


async def test_rewrite_passes_temperature_and_max_tokens(mock_db):
    router = _make_mock_router()
    service = AIService(router=router, loader=_make_mock_loader(), svc=_make_mock_svc())

    await service.rewrite(
        mock_db,
        selected_text="x",
        instruction="y",
        temperature=0.2,
        max_tokens=123,
    )
    kwargs = router.complete.call_args.kwargs
    assert kwargs["temperature"] == 0.2
    assert kwargs["max_tokens"] == 123


async def test_rewrite_omits_overrides_when_not_provided(mock_db):
    router = _make_mock_router()
    service = AIService(router=router, loader=_make_mock_loader(), svc=_make_mock_svc())

    await service.rewrite(mock_db, selected_text="x", instruction="y")
    kwargs = router.complete.call_args.kwargs
    # No per-action default for rewrite → fall through to router defaults.
    assert "temperature" not in kwargs
    assert "max_tokens" not in kwargs


async def test_describe_passes_overrides_to_every_channel(mock_db):
    router = _make_mock_router()
    service = AIService(router=router, loader=_make_mock_loader(), svc=_make_mock_svc())

    await service.describe(
        mock_db,
        selected_text="x",
        channels=["Látás", "Hang"],
        temperature=1.5,
        max_tokens=256,
    )
    assert router.complete.call_count == 2
    for call in router.complete.call_args_list:
        assert call.kwargs["temperature"] == 1.5
        assert call.kwargs["max_tokens"] == 256


async def test_write_continue_keeps_word_count_default_when_omitted(mock_db):
    router = _make_mock_router()
    service = AIService(router=router, loader=_make_mock_loader(), svc=_make_mock_svc())

    await service.write_continue(mock_db, scene_text="x", word_count_target=400)
    kwargs = router.complete.call_args.kwargs
    # Per-action default preserved: word_count_target * 3.
    assert kwargs["max_tokens"] == 1200
    assert "temperature" not in kwargs


async def test_write_continue_override_beats_word_count_default(mock_db):
    router = _make_mock_router()
    service = AIService(router=router, loader=_make_mock_loader(), svc=_make_mock_svc())

    await service.write_continue(
        mock_db,
        scene_text="x",
        word_count_target=400,
        temperature=0.9,
        max_tokens=999,
    )
    kwargs = router.complete.call_args.kwargs
    assert kwargs["max_tokens"] == 999  # override wins over word_count_target * 3
    assert kwargs["temperature"] == 0.9


async def test_generate_scene_keeps_default_max_tokens_when_omitted(mock_db):
    router = _make_mock_router()
    service = AIService(router=router, loader=_make_mock_loader(), svc=_make_mock_svc())

    await service.generate_scene(mock_db, beats=["a", "b"])
    kwargs = router.complete.call_args.kwargs
    assert kwargs["max_tokens"] == 4096  # per-action default preserved
    assert "temperature" not in kwargs


async def test_generate_scene_override_max_tokens(mock_db):
    router = _make_mock_router()
    service = AIService(router=router, loader=_make_mock_loader(), svc=_make_mock_svc())

    await service.generate_scene(mock_db, beats=["a"], max_tokens=2000, temperature=0.4)
    kwargs = router.complete.call_args.kwargs
    assert kwargs["max_tokens"] == 2000
    assert kwargs["temperature"] == 0.4


async def test_summarize_keeps_default_max_tokens_when_omitted(mock_db):
    router = _make_mock_router()
    service = AIService(router=router, loader=_make_mock_loader(), svc=_make_mock_svc())

    await service.summarize(mock_db, content="x", content_type="jelenet")
    kwargs = router.complete.call_args.kwargs
    assert kwargs["max_tokens"] == 512  # per-action default preserved
    assert "temperature" not in kwargs


async def test_summarize_override_temperature_only(mock_db):
    router = _make_mock_router()
    service = AIService(router=router, loader=_make_mock_loader(), svc=_make_mock_svc())

    await service.summarize(mock_db, content="x", temperature=0.1)
    kwargs = router.complete.call_args.kwargs
    # temperature overridden, max_tokens falls back to per-action default 512.
    assert kwargs["temperature"] == 0.1
    assert kwargs["max_tokens"] == 512


# ── generate_scene_revision (chapter-automation reusable core) ─────────────────
# The reusable per-scene generation unit. It does RAG + model + save_revision and
# returns the Revision — it does NOT create or complete a GenerationJob (the job
# is owned by the caller: the single-scene endpoint, or a parent chapter job).


def _make_scene_orm(scene_id):
    """A minimal Scene-like ORM stub exposing .id (what RAG keys off)."""
    scene = MagicMock(spec=Scene)
    scene.id = scene_id
    return scene


def _service_with_stubbed_rag(svc):
    """An AIService whose RAG layer is stubbed to no-context, so these unit tests
    exercise the job/revision wiring against a bare AsyncMock db without touching
    the embedding/progression DB path (covered by the rag-integration suite)."""
    service = AIService(router=_make_mock_router(), loader=_make_mock_loader(), svc=svc)
    service._rag_context = AsyncMock(return_value=("", []))
    return service


async def test_generate_scene_revision_returns_unapproved_linked_revision(mock_db):
    """The returned Revision is approved=False and carries the passed job_id +
    the scene's id + revision_type='generate_scene'."""
    scene_id = uuid.uuid4()
    job_id = uuid.uuid4()
    captured = {}

    svc = _make_mock_svc()

    async def _capture_save_revision(db, **kwargs):
        captured.update(kwargs)
        return Revision(
            scene_id=kwargs.get("scene_id"),
            job_id=kwargs.get("job_id"),
            content="text",
            revision_type=kwargs.get("revision_type"),
            approved=False,
        )

    svc.save_revision.side_effect = _capture_save_revision

    service = _service_with_stubbed_rag(svc)
    revision, _context_entities = await service.generate_scene_revision(
        mock_db,
        scene=_make_scene_orm(scene_id),
        beats=["A hős belép"],
        job_id=job_id,
    )

    assert revision.approved is False
    # The Revision is linked to the PASSED job_id (mutation-check: breaking the
    # job_id link — e.g. passing None — fails here).
    assert captured["job_id"] == job_id
    assert captured["scene_id"] == scene_id
    assert captured["revision_type"] == "generate_scene"


async def test_generate_scene_revision_does_not_create_or_complete_a_job(mock_db):
    """The reusable core MUST NOT own a job: no create_job / complete_job /
    fail_job calls — the caller (endpoint or parent chapter job) owns it."""
    svc = _make_mock_svc()
    service = _service_with_stubbed_rag(svc)

    await service.generate_scene_revision(
        mock_db,
        scene=_make_scene_orm(uuid.uuid4()),
        beats=["a", "b"],
        job_id=uuid.uuid4(),
    )

    svc.create_job.assert_not_called()
    svc.complete_job.assert_not_called()
    svc.fail_job.assert_not_called()
    svc.save_revision.assert_called_once()


async def test_generate_scene_revision_accepts_scene_id_directly(mock_db):
    """`scene` may be a bare UUID (not an ORM object) — the scene's id still
    reaches save_revision."""
    scene_id = uuid.uuid4()
    job_id = uuid.uuid4()
    svc = _make_mock_svc()
    service = _service_with_stubbed_rag(svc)

    await service.generate_scene_revision(
        mock_db, scene=scene_id, beats=["a"], job_id=job_id
    )
    kwargs = svc.save_revision.call_args.kwargs
    assert kwargs["scene_id"] == scene_id
    assert kwargs["job_id"] == job_id
