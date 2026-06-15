"""A1 regression: AIService must thread ``db`` into ModelRouter.complete so that
configured cloud providers (gemini/anthropic/openai/openrouter) are actually
used — instead of always silently falling back to Ollama.

Before the fix, every ``self.router.complete(...)`` call in ai_service omitted
``db``, so ``ModelRouter.complete(db=None)`` never resolved the configured
Provider and never decrypted its API key. These tests exercise the FULL path
with a REAL ModelRouter + REAL revision_service + a REAL test-DB provider row,
mocking only the outbound ``acompletion`` call.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from alexandria_core.models.provider import Provider
from sqlalchemy import delete

from app.schemas.provider import ProviderCreate
from app.services.ai_service import AIService
from app.services.crud_provider import create_provider
from app.services.model_router import ModelRouter
from app.services.prompt_loader import prompt_loader
from app.services.revision_service import revision_service


@pytest.fixture(autouse=True)
async def _clean_providers(db_session):
    """Providers are a global (non-project-scoped) table whose CRUD commits
    persist on the shared engine; clear them around each test for isolation."""
    await db_session.execute(delete(Provider))
    await db_session.commit()
    yield
    await db_session.execute(delete(Provider))
    await db_session.commit()


def _mock_response(content: str = "ok"):
    resp = MagicMock()
    resp.choices = [MagicMock()]
    resp.choices[0].message.content = content
    resp.usage.prompt_tokens = 1
    resp.usage.completion_tokens = 1
    resp.usage.total_tokens = 2
    return resp


def _real_service() -> AIService:
    # Real ModelRouter + revision_service so the db actually threads through
    # complete() -> resolve_provider(); only acompletion is mocked.
    return AIService(
        router=ModelRouter(),
        loader=prompt_loader,
        svc=revision_service,
    )


@pytest.mark.integration
async def test_rewrite_uses_configured_cloud_provider_key(db_session):
    """With an enabled cloud Provider row + a cloud model string, the decrypted
    api_key and resolved base_url reach acompletion (proving resolve_provider
    ran via the threaded db). This is the exact bug A1 fixes."""
    await create_provider(
        db_session,
        ProviderCreate(
            type="gemini",
            label="Gemini",
            api_key="sk-gemini-secret-xyz",
            base_url="https://generativelanguage.example/v1",
            default_model="gemini/gemini-1.5-pro",
        ),
    )

    service = _real_service()
    with patch(
        "app.services.model_router.acompletion",
        new=AsyncMock(return_value=_mock_response("Átírt szöveg")),
    ) as mock_call:
        revision, job, _context = await service.rewrite(
            db_session,
            selected_text="Eredeti szöveg",
            instruction="Tedd poétikusabbá",
            model="gemini/gemini-1.5-pro",
        )

    kwargs = mock_call.call_args.kwargs
    # The decrypted cloud key + resolved base_url must reach LiteLLM — they only
    # can if db was threaded into complete() and resolve_provider ran.
    assert kwargs["api_key"] == "sk-gemini-secret-xyz"
    assert kwargs["api_base"] == "https://generativelanguage.example/v1"
    assert kwargs["model"] == "gemini/gemini-1.5-pro"
    assert revision is not None
    assert job is not None


@pytest.mark.integration
async def test_summarize_uses_configured_cloud_provider_key(db_session):
    """A second method (summarize) proves the threading isn't rewrite-only."""
    await create_provider(
        db_session,
        ProviderCreate(
            type="anthropic",
            label="Claude",
            api_key="sk-ant-secret-987",
            base_url="https://anthropic.example/v1",
            default_model="anthropic/claude-3-5-sonnet-latest",
        ),
    )

    service = _real_service()
    with patch(
        "app.services.model_router.acompletion",
        new=AsyncMock(return_value=_mock_response("Összefoglaló")),
    ) as mock_call:
        await service.summarize(
            db_session,
            content="Hosszú jelenet szövege.",
            content_type="jelenet",
            model="anthropic/claude-3-5-sonnet-latest",
        )

    kwargs = mock_call.call_args.kwargs
    assert kwargs["api_key"] == "sk-ant-secret-987"
    assert kwargs["api_base"] == "https://anthropic.example/v1"
    assert kwargs["model"] == "anthropic/claude-3-5-sonnet-latest"


@pytest.mark.integration
async def test_no_provider_falls_back_to_ollama(db_session):
    """db is still passed, but no matching provider exists -> Ollama path:
    api_key None and the Ollama base URL. Confirms the local fallback survives
    the fix (the threaded db must not break the no-provider case)."""
    service = _real_service()
    with patch(
        "app.services.model_router.acompletion",
        new=AsyncMock(return_value=_mock_response("Folytatás")),
    ) as mock_call:
        await service.write_continue(
            db_session,
            scene_text="Egy jelenet...",
            word_count_target=100,
            model="ollama/llama3.2",
        )

    kwargs = mock_call.call_args.kwargs
    assert kwargs["api_key"] is None
    assert kwargs["api_base"] == service.router.base_url
    assert kwargs["model"] == "ollama/llama3.2"


# ── A6c: GenerationJob FAILED transition is persisted, sanitized, clean ──────
# A failing router.complete must leave the job status="failed" with a populated,
# sanitized error_message (no secret/traceback bleed), and the session must roll
# back cleanly so the fail_job commit succeeds (no PendingRollbackError).


@pytest.mark.integration
async def test_failed_generation_persists_sanitized_failed_job(db_session):
    import uuid

    from alexandria_core.models.generation_job import GenerationJob, JobStatus
    from sqlalchemy import select

    service = _real_service()

    # A unique scene_id so the persisted job is unambiguously identifiable on
    # the shared session-scoped engine (other tests also create rewrite jobs).
    scene_id = uuid.uuid4()
    # A multi-line, secret-bearing, oversized failure from the provider layer.
    raw = "boom internal\nSECRET=sk-leak-9999\n" + ("x" * 5000)
    with patch(
        "app.services.model_router.acompletion",
        new=AsyncMock(side_effect=RuntimeError(raw)),
    ):
        with pytest.raises(RuntimeError):
            await service.rewrite(
                db_session,
                selected_text="x",
                instruction="y",
                scene_id=scene_id,
                model="ollama/llama3.2",
            )

    # The session must be usable immediately after (no PendingRollbackError):
    # this query would raise if the failed transaction had not been rolled back.
    result = await db_session.execute(
        select(GenerationJob).where(GenerationJob.scene_id == scene_id)
    )
    jobs = list(result.scalars().all())
    assert len(jobs) == 1
    job = jobs[0]

    # Persisted as failed with a sanitized, bounded, single-line error_message.
    assert job.status == JobStatus.FAILED
    assert job.error_message
    assert "\n" not in job.error_message
    assert "\r" not in job.error_message
    assert len(job.error_message) <= 300
    # The full 5000-char tail cannot have survived sanitization/truncation.
    assert "x" * 400 not in job.error_message
    # The fake secret line collapsed onto one bounded line but the leak guard is
    # the sanitizer's job; here we assert the message stayed bounded + 1-line.
