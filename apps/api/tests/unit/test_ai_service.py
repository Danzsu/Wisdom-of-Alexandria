import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.ai_service import AIService, DESCRIBE_CHANNELS
from app.services.model_router import ModelRouter, ModelResponse
from app.services.prompt_loader import PromptLoader
from app.services.revision_service import RevisionService
from app.models.revision import Revision
from app.models.generation_job import GenerationJob, JobStatus


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

    revision, job = await service.rewrite(
        mock_db,
        selected_text="Eredeti szöveg",
        instruction="Tedd poétikusabbá",
    )
    router.complete.assert_called_once()
    svc.save_revision.assert_called_once()
    assert revision is not None
    assert job is not None


async def test_rewrite_fails_job_on_exception(mock_db):
    router = _make_mock_router()
    loader = _make_mock_loader()
    svc = _make_mock_svc()
    router.complete.side_effect = Exception("LLM error")

    service = AIService(router=router, loader=loader, svc=svc)
    with pytest.raises(Exception, match="LLM error"):
        await service.rewrite(mock_db, selected_text="x", instruction="y")
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
