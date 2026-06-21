"""HITL (human-in-the-loop) cross-service CONTRACT test — AI side.

What this proves
----------------
The human-in-the-loop contract between the two Alexandria backends:

    apps/ai   writes a Revision (approved=False) for a scene  ──┐
                                                                 │ shared
    alexandria_core.models.Revision  (ONE schema, both sides)    │ Postgres
                                                                 │
    apps/api  reads that Revision via crud_revision.approve_  ◀──┘
              revision and applies content + word_count to Scene

This file exercises the **AI write side** against a real (test) DB: it calls the
REAL ``revision_service.save_revision`` and the REAL ``AIService.rewrite`` path
(only ``litellm.acompletion`` is mocked — no live LLM) and asserts the persisted
Revision can NEVER be auto-approved and carries exactly the fields the domain
side consumes.

Why this is a CONTRACT-level (not live-HTTP) test
--------------------------------------------------
Both apps ship the SAME top-level import package name ``app`` (see each
``[tool.hatch.build.targets.wheel] packages = ["app"]`` in apps/api and apps/ai
pyproject.toml). Two modules both named ``app`` cannot be imported into one
Python process, so an in-process test that imports BOTH FastAPI apps is
infeasible. The mitigating fact is that the ``Revision`` model lives in shared
``alexandria_core`` — so the two sides share ONE schema and structural field
drift is impossible; only the SEMANTIC contract (AI writes approved=False + a
valid scene_id; domain consumes it) is at risk, and that is what these tests
pin. The full out-of-process E2E (both services live against one Postgres) is a
CI/Playwright-layer concern per CLAUDE.md's E2E layer; this pair approximates it
in-process via the shared model. The DOMAIN-read half lives in
apps/api/tests/integration/test_revision_export_flow.py
(``test_hitl_contract_domain_consumes_ai_revision``).

Contract fields the AI side writes and the domain side reads
------------------------------------------------------------
  * approved        -> MUST be False  (domain flips it True on approve)
  * scene_id        -> set/linked     (domain loads Scene by it, updates content)
  * content         -> present        (domain copies it to Scene.content)
  * revision_type   -> populated      (provenance; e.g. "rewrite")
  * model_name      -> populated      (provenance: which model produced it)
  * prompt_version  -> populated      (provenance: which prompt version)
  * job_id          -> linked         (provenance: the GenerationJob)
"""
from unittest.mock import AsyncMock, patch

import pytest
from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.generation_job import GenerationJob, JobStatus
from alexandria_core.models.project import Project
from alexandria_core.models.revision import Revision
from alexandria_core.models.scene import Scene
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.ai_service import AIService
from app.services.model_router import ModelRouter
from app.services.prompt_loader import PromptLoader
from app.services.revision_service import revision_service


async def _make_scene(db: AsyncSession) -> Scene:
    """Persist a real project → book → chapter → scene chain in the test DB.

    Scene.chapter_id is a NOT NULL FK, so the full parent chain must exist for
    a realistic, FK-valid insert (mirrors how a scene exists in production).
    """
    project = Project(title="Kontraktus projekt")
    db.add(project)
    await db.flush()
    book = Book(project_id=project.id, title="Kontraktus könyv")
    db.add(book)
    await db.flush()
    chapter = Chapter(book_id=book.id, title="Kontraktus fejezet")
    db.add(chapter)
    await db.flush()
    scene = Scene(chapter_id=chapter.id, title="Kontraktus jelenet", content="Eredeti.")
    db.add(scene)
    await db.commit()
    await db.refresh(scene)
    return scene


# ── 1) the real AI write path: revision_service.save_revision ───────────────────

async def test_save_revision_upholds_hitl_contract_against_real_db(db_session: AsyncSession):
    """REAL save_revision against the test DB persists an unapproved, scene-linked
    Revision carrying every provenance field the domain side reads on approve."""
    scene = await _make_scene(db_session)
    # revisions.job_id is a real FK to generation_jobs, so the job must exist
    # (the contract literally links a Revision to its producing GenerationJob).
    # A bare UUID survives SQLite (FKs off by default) but violates the FK on
    # PostgreSQL — persist a real job and link to it.
    job = GenerationJob(scene_id=scene.id, job_type="rewrite", status=JobStatus.DONE)
    db_session.add(job)
    await db_session.commit()
    job_id = job.id

    rev = await revision_service.save_revision(
        db_session,
        content="A vihar közeledett, az ég elsötétült.",
        revision_type="rewrite",
        scene_id=scene.id,
        job_id=job_id,
        model_name="ollama/llama3.2",
        prompt_version="1.0",
    )

    # Re-read from the DB (not just the in-memory object) to prove it persisted
    # exactly as the domain side will later SELECT it.
    persisted = (
        await db_session.execute(select(Revision).where(Revision.id == rev.id))
    ).scalar_one()

    # The core HITL invariant: the AI side NEVER auto-approves.
    assert persisted.approved is False
    # scene_id is set + actually points at the real scene the domain will load.
    assert persisted.scene_id == scene.id
    # content is present (domain copies this into Scene.content).
    assert persisted.content == "A vihar közeledett, az ég elsötétült."
    # Provenance fields the domain reads / displays.
    assert persisted.revision_type == "rewrite"
    assert persisted.model_name == "ollama/llama3.2"
    assert persisted.prompt_version == "1.0"
    assert persisted.job_id == job_id


async def test_save_revision_defaults_approved_false_even_without_scene(
    db_session: AsyncSession,
):
    """A scene-less revision (e.g. a describe channel) is still unapproved — the
    approved=False invariant is unconditional, never dependent on scene linkage."""
    rev = await revision_service.save_revision(
        db_session,
        content="Csatorna tartalom.",
        revision_type="describe_channel",
        scene_id=None,
    )
    persisted = (
        await db_session.execute(select(Revision).where(Revision.id == rev.id))
    ).scalar_one()
    assert persisted.approved is False
    assert persisted.scene_id is None
    assert persisted.content == "Csatorna tartalom."


# ── 2) the full AIService.rewrite path (acompletion mocked) ─────────────────────

async def test_ai_service_rewrite_persists_unapproved_revision(db_session: AsyncSession):
    """The full AIService.rewrite path — with only litellm.acompletion mocked —
    persists a real Revision with approved=False linked to the real scene.

    This proves the END-TO-END AI write path (job → LLM call → save_revision →
    complete_job) upholds the HITL contract, not merely the leaf save helper.
    """
    scene = await _make_scene(db_session)

    # Mock the single external dependency: the LLM call. Everything else
    # (RevisionService, GenerationJob persistence, the real DB session) runs
    # for real. We patch acompletion where ModelRouter imports it.
    fake_response = AsyncMock()
    fake_response.choices = [AsyncMock()]
    fake_response.choices[0].message.content = "Átírt, drámaibb szöveg."
    fake_response.usage.prompt_tokens = 5
    fake_response.usage.completion_tokens = 7
    fake_response.usage.total_tokens = 12

    service = AIService(
        router=ModelRouter(),
        loader=PromptLoader(),  # loads the real rewrite prompt templates
        svc=revision_service,
    )

    with patch(
        "app.services.model_router.acompletion",
        new=AsyncMock(return_value=fake_response),
    ):
        revision, job, _context = await service.rewrite(
            db_session,
            selected_text="Eredeti szöveg.",
            instruction="Tedd drámaibbá",
            scene_id=scene.id,
            model="ollama/llama3.2",
        )

    # Re-read the persisted revision to assert the on-disk contract shape.
    persisted = (
        await db_session.execute(select(Revision).where(Revision.id == revision.id))
    ).scalar_one()
    assert persisted.approved is False  # the contract: AI output is never auto-approved
    assert persisted.scene_id == scene.id
    assert persisted.content == "Átírt, drámaibb szöveg."
    assert persisted.revision_type == "rewrite"
    assert persisted.job_id == job.id
    assert persisted.model_name == "ollama/llama3.2"
    assert persisted.prompt_version is not None


@pytest.mark.parametrize(
    "action",
    ["rewrite", "write_continue", "generate_scene", "summarize"],
)
async def test_every_ai_action_writes_unapproved_revision(
    db_session: AsyncSession, action: str
):
    """Across every single-revision AI action, the persisted Revision is
    approved=False. Guards against a future action accidentally auto-approving."""
    scene = await _make_scene(db_session)

    fake_response = AsyncMock()
    fake_response.choices = [AsyncMock()]
    fake_response.choices[0].message.content = "Generált tartalom."
    fake_response.usage.prompt_tokens = 1
    fake_response.usage.completion_tokens = 1
    fake_response.usage.total_tokens = 2

    service = AIService(
        router=ModelRouter(), loader=PromptLoader(), svc=revision_service
    )

    kwargs: dict = {"scene_id": scene.id, "model": "ollama/llama3.2"}
    if action == "rewrite":
        kwargs |= {"selected_text": "x", "instruction": "y"}
    elif action == "write_continue":
        kwargs |= {"scene_text": "x"}
    elif action == "generate_scene":
        kwargs |= {"beats": ["a hős belép", "meglátja az ellenfelet"]}
    elif action == "summarize":
        kwargs |= {"content": "Hosszú szöveg összefoglalásra."}

    with patch(
        "app.services.model_router.acompletion",
        new=AsyncMock(return_value=fake_response),
    ):
        # rewrite/write_continue/generate_scene return a 3-tuple (…,
        # context_entities); summarize returns a 2-tuple. Take the revision
        # (first element) uniformly.
        result = await getattr(service, action)(db_session, **kwargs)
        revision = result[0]

    persisted = (
        await db_session.execute(select(Revision).where(Revision.id == revision.id))
    ).scalar_one()
    assert persisted.approved is False
    assert persisted.scene_id == scene.id
    # Truthy, not just non-None — an empty-string revision_type would also be a bug.
    assert persisted.revision_type
