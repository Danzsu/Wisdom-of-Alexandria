import logging
import uuid
from typing import Annotated

from alexandria_core.core.config import settings
from alexandria_core.core.deps import get_current_user, get_db
from alexandria_core.core.errors import safe_error
from alexandria_core.models.beat import Beat
from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.generation_job import JobStatus
from alexandria_core.models.project import Project
from alexandria_core.models.scene import Scene
from alexandria_core.schemas.revision import RevisionRead
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.generation_job import GenerationJobRead
from app.services.ai_service import AIService, ai_service
from app.services.crud_generation_job import (
    create_book_generation_job,
    create_chapter_generation_job,
    create_index_job,
)
from app.services.crud_provider import list_providers
from app.services.embedding_service import (
    EmbeddingDimError,
    EmbeddingService,
    SyncResult,
    embedding_service,
)
from app.services.job_queue import (
    enqueue_book_generation_job,
    enqueue_chapter_generation_job,
    enqueue_index_job,
)
from app.services.provider_service import list_provider_models

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


def get_ai_service() -> AIService:
    return ai_service


def get_embedding_service() -> EmbeddingService:
    return embedding_service


# ── Model listing ─────────────────────────────────────────────────────────────
# The UI must NEVER hardcode model names (CLAUDE.md). It reads the available
# models from this endpoint, which derives them from the ModelRouter / settings
# configuration. MVP exposes the configured local (Ollama) model; cloud providers
# are added in V1 once they are configured in settings.


class ModelInfo(BaseModel):
    id: str
    label: str
    kind: str  # "local" | "cloud"
    moderated: bool = False


class ModelsResponse(BaseModel):
    models: list[ModelInfo]
    default: str


@router.get("/models", response_model=ModelsResponse)
async def list_models(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ModelsResponse:
    """Return the AI models the backend is configured to use.

    Aggregated from the configured + enabled Provider rows (local Ollama + any
    cloud providers). The built-in Ollama default from settings is always
    included so the app works out of the box with no providers configured. Model
    names are never hardcoded in the UI — it reads them from here.
    """
    default = settings.default_local_model
    seen: set[str] = set()
    models: list[ModelInfo] = []

    def _add(model_id: str, kind: str) -> None:
        if model_id in seen:
            return
        seen.add(model_id)
        label = model_id.split("/", 1)[-1] if "/" in model_id else model_id
        models.append(ModelInfo(id=model_id, label=label, kind=kind))

    # Always expose the built-in local default (back-compat / zero-config).
    _add(default, "local")

    providers = await list_providers(db, enabled_only=True)
    for provider in providers:
        kind = "local" if provider.type == "ollama" else "cloud"
        for m in await list_provider_models(provider):
            _add(m.id, kind)

    return ModelsResponse(models=models, default=default)


# ── Request schemas ──────────────────────────────────────────────────────────
# Generation parameters (temperature / max_tokens) are OPTIONAL on every AI
# request. The frontend Settings → Generálás panel persists them and sends them
# on each request. When omitted (None), AIService keeps its per-action defaults
# (see ModelRouter.complete + per-method max_tokens) — fully backward compatible.

# Shared validation bounds. temperature: typical 0–2 sampling range; max_tokens:
# positive with a reasonable upper cap to avoid pathological requests.
_TemperatureField = Field(default=None, ge=0.0, le=2.0)
_MaxTokensField = Field(default=None, ge=1, le=32768)

# Length caps on free-text AI inputs. Generous enough for real long-form use
# (a long scene/chapter is well under this), but they reject a pathological
# payload with a 422 rather than letting it balloon a prompt / embedding cost.
_TEXT_MAX_CHARS = 200_000  # selected_text / scene_text / summarize content
_BEAT_MAX_CHARS = 2_000  # a single beat line


class RewriteRequest(BaseModel):
    selected_text: str = Field(max_length=_TEXT_MAX_CHARS)
    instruction: str
    scene_id: uuid.UUID | None = None
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


class DescribeRequest(BaseModel):
    selected_text: str = Field(max_length=_TEXT_MAX_CHARS)
    channels: list[str] | None = None  # defaults to all 6 in AIService
    scene_id: uuid.UUID | None = None
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


class WriteContinueRequest(BaseModel):
    scene_text: str = Field(max_length=_TEXT_MAX_CHARS)
    context: str = ""
    word_count_target: int = 300
    scene_id: uuid.UUID | None = None
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


class GenerateSceneRequest(BaseModel):
    # Each beat is length-capped so a pathological beat can't balloon the prompt.
    beats: list[Annotated[str, Field(max_length=_BEAT_MAX_CHARS)]]
    characters: str = ""
    location: str = ""
    style_notes: str = ""
    scene_id: uuid.UUID | None = None
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


class ChapterGenerateRequest(BaseModel):
    """Request to generate a chapter scene-by-scene as one background job (T2).

    ``scene_ids`` is the user-selected subset of the chapter's scenes to
    generate (bounded: at least one, at most ~200 — a whole chapter is well under
    this, but the cap blocks a pathological payload). ``run_continuity`` opts into
    a per-scene continuity pass on each generated draft. ``model`` / ``temperature``
    / ``max_tokens`` mirror the single-scene generate bounds.
    """

    scene_ids: list[uuid.UUID] = Field(min_length=1, max_length=200)
    run_continuity: bool = False
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


class BookGenerateRequest(BaseModel):
    """Request to generate ALL (selected) chapters of a book as one background
    job (V2: book-level chapter automation).

    ``chapter_ids`` is an OPTIONAL subset of the book's chapters; ``None`` (or
    omitted) selects ALL chapters. An explicit empty list is rejected — the
    "everything" selection is expressed by omission, not ``[]``. Per chapter the
    job auto-selects the SAFE default scenes (EMPTY content + at least one
    beat); the fine-grained per-scene opt-in stays a chapter-level feature.
    ``run_continuity`` / ``model`` / ``temperature`` / ``max_tokens`` mirror the
    chapter-generate request.
    """

    chapter_ids: list[uuid.UUID] | None = Field(
        default=None, min_length=1, max_length=500
    )
    run_continuity: bool = False
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


class SummarizeRequest(BaseModel):
    content: str = Field(max_length=_TEXT_MAX_CHARS)
    content_type: str = "jelenet"
    scene_id: uuid.UUID | None = None
    chapter_id: uuid.UUID | None = None
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


class ContinuityRequest(BaseModel):
    scene_id: uuid.UUID
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


class IndexRequest(BaseModel):
    # Optional body form of project_id; the query param takes precedence.
    project_id: uuid.UUID | None = None


class BrainstormRequest(BaseModel):
    """Sudowrite-style ötletelés: brainstorm story ideas for a topic/question,
    grounded via scene-scoped RAG when a ``scene_id`` is given."""

    # Bounded like ResearchRequest.question: generous for a real prompt, but a
    # pathological payload is a 422, not a ballooned LLM/embedding cost.
    topic: str = Field(min_length=1, max_length=8000)
    # How many ideas to ask for. Small hard cap — brainstorming returns a
    # scannable shortlist, not a firehose.
    count: int = Field(default=5, ge=1, le=10)
    scene_id: uuid.UUID | None = None
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


class ExpandRequest(BaseModel):
    """Expand a selection: add sensory detail / interiority, keep the voice."""

    selected_text: str = Field(max_length=_TEXT_MAX_CHARS)
    # Optional steering ("more interiority", "focus on smell") — bounded like a
    # research question; it is guidance, not manuscript text.
    guidance: str = Field(default="", max_length=8000)
    scene_id: uuid.UUID | None = None
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


class CompressRequest(BaseModel):
    """Tighten a selection: cut filler, keep meaning + voice."""

    selected_text: str = Field(max_length=_TEXT_MAX_CHARS)
    guidance: str = Field(default="", max_length=8000)
    scene_id: uuid.UUID | None = None
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


class ResearchRequest(BaseModel):
    """A free-form Codex/manuscript Q&A question, grounded via RAG (P2)."""

    # Bounded: an unbounded question inflates the LLM + embedding-query cost; the
    # cap is generous for a real question but blocks pathological input.
    question: str = Field(min_length=1, max_length=8000)
    project_id: uuid.UUID
    # Optional book/scene context: when given, retrieval is series-scoped to that
    # book's series (project-global + that series), else project-wide.
    scene_id: uuid.UUID | None = None
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


# ── Response schemas ─────────────────────────────────────────────────────────

class ContextEntity(BaseModel):
    """A Codex/manuscript entry that RAG injected into the generation context.

    Lets the UI show "grounded on: <these entries>". Empty whenever RAG was
    skipped (no scene_id, no embedding provider configured) or found nothing.
    """

    id: str
    label: str
    entity_type: str


class AIResult(BaseModel):
    revision: RevisionRead
    job: GenerationJobRead
    # Codex/manuscript entries retrieved + injected as context. Empty list when
    # RAG was skipped or returned nothing.
    context_entities: list[ContextEntity] = Field(default_factory=list)


class AIDescribeResult(BaseModel):
    revisions: list[RevisionRead]
    job: GenerationJobRead
    # describe does NOT use RAG; always empty — present for a uniform contract.
    context_entities: list[ContextEntity] = Field(default_factory=list)


class IndexResult(BaseModel):
    """Summary returned by ``POST /ai/index`` (project re-index)."""

    indexed: int
    updated: int
    deleted: int
    skipped: int
    capped: bool
    # True when RAG is unconfigured (no embedding provider) so nothing was done.
    skipped_no_provider: bool = False


class ContinuityWarning(BaseModel):
    """One structured continuity finding (B3).

    ``severity`` is one of info/warning/error (validated + clamped service-side,
    but kept a free ``str`` on the wire so a future severity still renders).
    ``message`` is the Hungarian description; ``entity`` is the affected Codex
    entity name, or ``None``.
    """

    severity: str
    message: str
    entity: str | None = None


class ContinuityResult(BaseModel):
    """Continuity-check response (B3). NO revision — this is analysis.

    ``warnings`` is empty when no issues were found (a positive "all clear").
    ``context_entities`` lists the codex entries RAG grounded the check on (empty
    when RAG was skipped / unconfigured — the check then ran on the scene text
    alone).
    """

    warnings: list[ContinuityWarning] = Field(default_factory=list)
    context_entities: list[ContextEntity] = Field(default_factory=list)


class BrainstormResult(BaseModel):
    """Brainstorm response. NO revision — ideas are not manuscript text.

    ``ideas`` is the parsed idea list (at most the requested ``count``; a single
    fallback idea when the model's output was unusable). ``job`` is the
    ``brainstorm`` GenerationJob provenance record (``null`` only for the
    whitespace-topic short-circuit). ``context_entities`` lists the Codex/
    manuscript entries RAG grounded the ideas on (empty when RAG was skipped /
    unconfigured).
    """

    ideas: list[str] = Field(default_factory=list)
    job: GenerationJobRead | None = None
    context_entities: list[ContextEntity] = Field(default_factory=list)


class ResearchResult(BaseModel):
    """Codex/manuscript Q&A response (P2). NO revision — this is analysis.

    ``answer`` is the model's grounded answer (empty only for an empty question).
    ``context_entities`` lists the Codex/manuscript entries RAG grounded the
    answer on (empty when RAG was skipped / unconfigured — the model then answered
    from the question alone), shown as citation chips.
    """

    answer: str = ""
    context_entities: list[ContextEntity] = Field(default_factory=list)


# ── Endpoints ────────────────────────────────────────────────────────────────


def _resolve_project_id(
    query_param: uuid.UUID | None, body: IndexRequest | None
) -> uuid.UUID:
    """Resolve the index target project id from the query param (preferred) or the
    request body, raising a 422 when neither is given. Shared by the sync + async
    index endpoints so the resolution + error contract stays in one place."""
    resolved = query_param or (body.project_id if body else None)
    if resolved is None:
        raise HTTPException(status_code=422, detail="project_id is required")
    return resolved


@router.post("/rewrite", response_model=AIResult)
async def rewrite(
    data: RewriteRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    svc: AIService = Depends(get_ai_service),
) -> AIResult:
    try:
        revision, job, context_entities = await svc.rewrite(
            db,
            selected_text=data.selected_text,
            instruction=data.instruction,
            scene_id=data.scene_id,
            model=data.model,
            temperature=data.temperature,
            max_tokens=data.max_tokens,
        )
        return AIResult(
            revision=RevisionRead.model_validate(revision),
            job=GenerationJobRead.model_validate(job),
            context_entities=[ContextEntity(**c) for c in context_entities],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI generation failed: {safe_error(e)}",
        )


@router.post("/brainstorm", response_model=BrainstormResult)
async def brainstorm(
    data: BrainstormRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    svc: AIService = Depends(get_ai_service),
) -> BrainstormResult:
    """Brainstorm story ideas (ötletelés) for a topic, grounded via RAG when a
    ``scene_id`` gives a book/scene context. Ideas are NOT manuscript text —
    there is NO revision; the ``brainstorm`` GenerationJob is the provenance.

    Degradation contract (no 500 for either case):
    - RAG/embeddings unconfigured → the model still brainstorms from the topic
      alone (empty ``context_entities``).
    - an unusable model response → a single visible fallback idea, never a
      crash.
    """
    try:
        ideas, job, context_entities = await svc.brainstorm(
            db,
            topic=data.topic,
            scene_id=data.scene_id,
            count=data.count,
            model=data.model,
            temperature=data.temperature,
            max_tokens=data.max_tokens,
        )
        return BrainstormResult(
            ideas=ideas,
            job=GenerationJobRead.model_validate(job) if job is not None else None,
            context_entities=[ContextEntity(**c) for c in context_entities],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI generation failed: {safe_error(e)}",
        )


@router.post("/expand", response_model=AIResult)
async def expand(
    data: ExpandRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    svc: AIService = Depends(get_ai_service),
) -> AIResult:
    """Expand the selection (sensory detail / interiority, voice preserved).
    HITL like rewrite: returns an unapproved ``Revision(revision_type="expand")``."""
    try:
        revision, job, context_entities = await svc.expand(
            db,
            selected_text=data.selected_text,
            guidance=data.guidance,
            scene_id=data.scene_id,
            model=data.model,
            temperature=data.temperature,
            max_tokens=data.max_tokens,
        )
        return AIResult(
            revision=RevisionRead.model_validate(revision),
            job=GenerationJobRead.model_validate(job),
            context_entities=[ContextEntity(**c) for c in context_entities],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI generation failed: {safe_error(e)}",
        )


@router.post("/compress", response_model=AIResult)
async def compress(
    data: CompressRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    svc: AIService = Depends(get_ai_service),
) -> AIResult:
    """Tighten the selection (cut filler, keep meaning + voice). HITL like
    rewrite: returns an unapproved ``Revision(revision_type="compress")``."""
    try:
        revision, job, context_entities = await svc.compress(
            db,
            selected_text=data.selected_text,
            guidance=data.guidance,
            scene_id=data.scene_id,
            model=data.model,
            temperature=data.temperature,
            max_tokens=data.max_tokens,
        )
        return AIResult(
            revision=RevisionRead.model_validate(revision),
            job=GenerationJobRead.model_validate(job),
            context_entities=[ContextEntity(**c) for c in context_entities],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI generation failed: {safe_error(e)}",
        )


@router.post("/describe", response_model=AIDescribeResult)
async def describe(
    data: DescribeRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    svc: AIService = Depends(get_ai_service),
) -> AIDescribeResult:
    # Channel validation is owned by AIService.describe (single authoritative
    # point — any future worker/direct caller gets it too). It raises ValueError
    # for invalid channels, which we map to a sanitized 422 below.
    try:
        revisions, job = await svc.describe(
            db,
            selected_text=data.selected_text,
            channels=data.channels,
            scene_id=data.scene_id,
            model=data.model,
            temperature=data.temperature,
            max_tokens=data.max_tokens,
        )
        return AIDescribeResult(
            revisions=[RevisionRead.model_validate(r) for r in revisions],
            job=GenerationJobRead.model_validate(job),
        )
    except ValueError as e:
        # Sanitized + consistent with every other AI error shape. The service's
        # message already lists the valid channels.
        raise HTTPException(status_code=422, detail=safe_error(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI generation failed: {safe_error(e)}",
        )


@router.post("/write-continue", response_model=AIResult)
async def write_continue(
    data: WriteContinueRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    svc: AIService = Depends(get_ai_service),
) -> AIResult:
    try:
        revision, job, context_entities = await svc.write_continue(
            db,
            scene_text=data.scene_text,
            context=data.context,
            word_count_target=data.word_count_target,
            scene_id=data.scene_id,
            model=data.model,
            temperature=data.temperature,
            max_tokens=data.max_tokens,
        )
        return AIResult(
            revision=RevisionRead.model_validate(revision),
            job=GenerationJobRead.model_validate(job),
            context_entities=[ContextEntity(**c) for c in context_entities],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI generation failed: {safe_error(e)}",
        )


@router.post("/generate-scene", response_model=AIResult)
async def generate_scene(
    data: GenerateSceneRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    svc: AIService = Depends(get_ai_service),
) -> AIResult:
    if not data.beats:
        raise HTTPException(status_code=422, detail="beats list cannot be empty")
    try:
        revision, job, context_entities = await svc.generate_scene(
            db,
            beats=data.beats,
            characters=data.characters,
            location=data.location,
            style_notes=data.style_notes,
            scene_id=data.scene_id,
            model=data.model,
            temperature=data.temperature,
            max_tokens=data.max_tokens,
        )
        return AIResult(
            revision=RevisionRead.model_validate(revision),
            job=GenerationJobRead.model_validate(job),
            context_entities=[ContextEntity(**c) for c in context_entities],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI generation failed: {safe_error(e)}",
        )


@router.post("/continuity", response_model=ContinuityResult)
async def continuity(
    data: ContinuityRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    svc: AIService = Depends(get_ai_service),
) -> ContinuityResult:
    """Continuity-check a scene against the project codex (B3).

    Returns STRUCTURED warnings (severity / message / entity) — analysis, not
    generated content, so there is NO revision. An empty ``warnings`` list is a
    positive "no issues found" result.

    Degradation contract (no 500 for either case):
    - RAG/embeddings unconfigured → the check still runs on the scene text alone
      (empty ``context_entities``).
    - ``scene_id`` resolves to no scene / empty content → an empty result
      (``warnings: []``, ``context_entities: []``), NOT a 404. The UI shows the
      positive "no issues" state; there is simply nothing to check.
    """
    try:
        warnings, _job, context_entities = await svc.check_continuity(
            db,
            scene_id=data.scene_id,
            model=data.model,
            temperature=data.temperature,
            max_tokens=data.max_tokens,
        )
        return ContinuityResult(
            warnings=[ContinuityWarning(**w) for w in warnings],
            context_entities=[ContextEntity(**c) for c in context_entities],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI generation failed: {safe_error(e)}",
        )


@router.post("/research", response_model=ResearchResult)
async def research(
    data: ResearchRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    svc: AIService = Depends(get_ai_service),
) -> ResearchResult:
    """Answer a free-form question grounded on the project's Codex + manuscript
    (RAG Q&A). Analysis only — NO revision, nothing is written to the manuscript.

    Degradation contract (no 500 for either case):
    - empty/whitespace question → empty answer + empty context_entities.
    - RAG/embeddings unconfigured → the model still answers from the question
      alone (empty context_entities), never an error.
    """
    # Validate the project exists BEFORE the job is created — otherwise a bogus
    # id would FK-violate on the job insert and surface as an opaque 502. Done
    # OUTSIDE the try so the 422 is not re-wrapped by the 502 handler below.
    if await db.get(Project, data.project_id) is None:
        raise HTTPException(status_code=422, detail="project_id does not exist")
    try:
        answer, _job, context_entities = await svc.research(
            db,
            question=data.question,
            project_id=data.project_id,
            scene_id=data.scene_id,
            model=data.model,
            temperature=data.temperature,
            max_tokens=data.max_tokens,
        )
        return ResearchResult(
            answer=answer,
            context_entities=[ContextEntity(**c) for c in context_entities],
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI generation failed: {safe_error(e)}",
        )


@router.post("/scenes/{scene_id}/summarize", response_model=AIResult)
async def summarize_scene(
    scene_id: uuid.UUID,
    data: SummarizeRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    svc: AIService = Depends(get_ai_service),
) -> AIResult:
    try:
        revision, job = await svc.summarize(
            db,
            content=data.content,
            content_type="jelenet",
            scene_id=scene_id,
            model=data.model,
            temperature=data.temperature,
            max_tokens=data.max_tokens,
        )
        return AIResult(
            revision=RevisionRead.model_validate(revision),
            job=GenerationJobRead.model_validate(job),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI generation failed: {safe_error(e)}",
        )


@router.post(
    "/chapters/{chapter_id}/generate",
    response_model=GenerationJobRead,
    status_code=status.HTTP_202_ACCEPTED,
)
async def generate_chapter(
    chapter_id: uuid.UUID,
    data: ChapterGenerateRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> GenerationJobRead:
    """Enqueue a chapter-generation job: generate each selected scene from its
    beats, scene-by-scene, as ONE background job (T2 / deferred MVP #11).

    Returns the queued parent ``GenerationJob`` (status ``pending``) immediately;
    poll ``GET /jobs/{id}`` for live per-scene progress (the worker flips it
    running → done, writes ``output_data`` after each scene, and links every
    generated ``Revision(approved=False)`` to THIS parent job — HITL preserved,
    nothing auto-overwrites).

    Validation (all BEFORE the job is created, so a bad request never leaves a
    dangling job):
      - the chapter must exist (404);
      - every ``scene_id`` must belong to that chapter (422 — cross-chapter or
        nonexistent scenes are rejected);
      - every selected scene must have at least one beat (422 — a guard; the UI
        disables beat-less scenes, this enforces it server-side).

    If the queue cannot be reached, the job is marked failed (so it never dangles
    as forever-pending) and a sanitized 502 is returned.
    """
    chapter = await db.get(Chapter, chapter_id)
    if chapter is None:
        raise HTTPException(status_code=404, detail="A fejezet nem található.")

    # Resolve the selected scenes that ACTUALLY belong to this chapter, with their
    # beat counts, in one query. Any selected id missing from this set is either a
    # nonexistent scene or one in another chapter — both rejected as 422.
    rows = (
        await db.execute(
            select(Scene.id, func.count(Beat.id))
            .outerjoin(Beat, Beat.scene_id == Scene.id)
            .where(Scene.chapter_id == chapter_id, Scene.id.in_(data.scene_ids))
            .group_by(Scene.id)
        )
    ).all()
    beat_counts = {scene_id: count for scene_id, count in rows}

    missing = [s for s in data.scene_ids if s not in beat_counts]
    if missing:
        raise HTTPException(
            status_code=422,
            detail="Egy vagy több jelenet nem ehhez a fejezethez tartozik.",
        )
    beatless = [s for s in data.scene_ids if beat_counts.get(s, 0) == 0]
    if beatless:
        raise HTTPException(
            status_code=422,
            detail="Minden kijelölt jelenethez legalább egy beat szükséges.",
        )

    # Resolve the project from the chapter's book (chapter_id is a plain column on
    # GenerationJob; project_id scopes the job for per-project polling/cleanup).
    project_id = (
        await db.execute(
            select(Book.project_id).where(Book.id == chapter.book_id)
        )
    ).scalar_one()

    input_data: dict = {
        "scene_ids": [str(s) for s in data.scene_ids],
        "run_continuity": data.run_continuity,
    }
    if data.model is not None:
        input_data["model"] = data.model
    if data.temperature is not None:
        input_data["temperature"] = data.temperature
    if data.max_tokens is not None:
        input_data["max_tokens"] = data.max_tokens

    job = await create_chapter_generation_job(
        db, chapter_id=chapter_id, project_id=project_id, input_data=input_data
    )
    try:
        enqueue_chapter_generation_job(job.id)
    except Exception as e:
        # The job row exists but could not be queued (e.g. Redis unreachable).
        # Mark it failed so it is not stuck PENDING forever. The 502 detail is a
        # FIXED message — the enqueue exception can carry the broker URL incl.
        # credentials, and safe_error only bounds (does NOT strip secrets) — so we
        # never echo it to the client. The cause is logged server-side (sanitized).
        logger.warning("Chapter-generate job enqueue failed: %s", safe_error(e))
        job.status = JobStatus.FAILED
        job.error_message = "A feladat sorba állítása nem sikerült."
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not enqueue chapter generation job (queue unavailable).",
        )
    return GenerationJobRead.model_validate(job)


@router.post(
    "/books/{book_id}/generate",
    response_model=GenerationJobRead,
    status_code=status.HTTP_202_ACCEPTED,
)
async def generate_book(
    book_id: uuid.UUID,
    data: BookGenerateRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> GenerationJobRead:
    """Enqueue a BOOK-generation job: generate every selected chapter, chapter
    by chapter, scene by scene, as ONE background job (V2: book-level chapter
    automation — the sequential wrapper over the chapter machinery).

    Returns the queued parent ``GenerationJob`` (status ``pending``)
    immediately; poll ``GET /jobs/{id}`` for live book-level progress (the
    worker flips it running → done, commits ``output_data`` after each scene /
    chapter, and links every generated ``Revision(approved=False)`` to THIS
    parent job — HITL preserved, nothing auto-overwrites).

    Selection semantics: ``chapter_ids`` omitted/null → ALL the book's chapters
    (story order). Per chapter the job auto-selects the SAFE default — scenes
    that are EMPTY (no content) AND have at least one beat; chapters with no
    such scene are recorded as skipped by the worker. Validation (all BEFORE
    the job is created, so a bad request never leaves a dangling job):
      - the book must exist (404);
      - every ``chapter_id`` must belong to that book (422);
      - at least ONE selected chapter must have a generatable scene (422).

    If the queue cannot be reached, the job is marked failed (so it never
    dangles as forever-pending) and a sanitized 502 is returned.
    """
    book = await db.get(Book, book_id)
    if book is None:
        raise HTTPException(status_code=404, detail="A könyv nem található.")

    # The book's chapters in story (order_index) order — the basis both for the
    # membership check and for resolving the null-selection ("ALL").
    book_chapter_ids = (
        (
            await db.execute(
                select(Chapter.id)
                .where(Chapter.book_id == book_id)
                .order_by(Chapter.order_index)
            )
        )
        .scalars()
        .all()
    )
    if data.chapter_ids is None:
        resolved_chapter_ids = list(book_chapter_ids)
    else:
        selected = set(data.chapter_ids)
        if not selected.issubset(set(book_chapter_ids)):
            raise HTTPException(
                status_code=422,
                detail="Egy vagy több fejezet nem ehhez a könyvhöz tartozik.",
            )
        # Resolved to STORY order regardless of the request's ordering.
        resolved_chapter_ids = [c for c in book_chapter_ids if c in selected]

    # At least one selected chapter must have a generatable scene: EMPTY
    # content AND >=1 beat (the INNER join to Beat enforces the beat). The
    # worker re-resolves per chapter and records empty chapters as skipped —
    # this guard only rejects a run that could do NOTHING at all.
    has_generatable = (
        await db.execute(
            select(Scene.id)
            .join(Beat, Beat.scene_id == Scene.id)
            .where(
                Scene.chapter_id.in_(resolved_chapter_ids),
                Scene.content.is_(None) | (Scene.content == ""),
            )
            .limit(1)
        )
    ).first()
    if has_generatable is None:
        raise HTTPException(
            status_code=422,
            detail=(
                "Nincs generálható jelenet: egyik kijelölt fejezetben sincs "
                "üres jelenet legalább egy beattel."
            ),
        )

    input_data: dict = {
        "book_id": str(book_id),
        "chapter_ids": [str(c) for c in resolved_chapter_ids],
        "run_continuity": data.run_continuity,
    }
    if data.model is not None:
        input_data["model"] = data.model
    if data.temperature is not None:
        input_data["temperature"] = data.temperature
    if data.max_tokens is not None:
        input_data["max_tokens"] = data.max_tokens

    job = await create_book_generation_job(
        db, book_id=book_id, project_id=book.project_id, input_data=input_data
    )
    try:
        enqueue_book_generation_job(job.id)
    except Exception as e:
        # The job row exists but could not be queued (e.g. Redis unreachable).
        # Mark it failed so it is not stuck PENDING forever. The 502 detail is a
        # FIXED message — the enqueue exception can carry the broker URL incl.
        # credentials, and safe_error only bounds (does NOT strip secrets) — so
        # we never echo it to the client. The cause is logged server-side.
        logger.warning("Book-generate job enqueue failed: %s", safe_error(e))
        job.status = JobStatus.FAILED
        job.error_message = "A feladat sorba állítása nem sikerült."
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not enqueue book generation job (queue unavailable).",
        )
    return GenerationJobRead.model_validate(job)


@router.post("/index", response_model=IndexResult)
async def index_project(
    project_id: uuid.UUID | None = None,
    body: IndexRequest | None = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    svc: EmbeddingService = Depends(get_embedding_service),
) -> IndexResult:
    """Re-index a project's RAG content (Codex + manuscript).

    ``project_id`` may be given as a query param (preferred) or in the body.
    When no embedding provider is configured, RAG is unconfigured: this returns
    zeroed counts with ``skipped_no_provider=True`` (a 200, not an error — cloud
    embeddings are optional).
    """
    resolved_project_id = _resolve_project_id(project_id, body)
    try:
        model = await svc.resolve_embedding_model(db)
        if model is None:
            return IndexResult(**SyncResult(skipped_no_provider=True).as_dict())
        result = await svc.sync_project(db, resolved_project_id, embedding_model=model)
        return IndexResult(**result.as_dict())
    except EmbeddingDimError as e:
        # A wrong-width embedding provider is a CONFIGURATION error: surface the
        # clear, actionable dim-mismatch message (expected vs actual + model)
        # verbatim instead of a generic "Indexing failed" so the operator can fix
        # the provider's embedding model rather than chasing an opaque 502.
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=safe_error(e),
        )
    except Exception as e:
        # Roll back so the request session is clean, then surface a sanitized
        # 502 (consistent with the other AI endpoints).
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Indexing failed: {safe_error(e)}",
        )


@router.post("/index/async", response_model=GenerationJobRead, status_code=status.HTTP_202_ACCEPTED)
async def index_project_async(
    project_id: uuid.UUID | None = None,
    body: IndexRequest | None = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> GenerationJobRead:
    """Enqueue an async project RAG re-index onto the worker queue.

    Returns the queued ``GenerationJob`` (status ``pending``) immediately;
    poll ``GET /jobs/{id}`` for progress (the worker flips it to running →
    done/failed and writes the index counts into ``output_data``). The worker
    resolves the embedding provider — when none is configured the job completes
    as a no-op (``output_data.skipped_no_provider = true``), never an error.

    ``project_id`` may be given as a query param (preferred) or in the body.
    If the queue cannot be reached, the job is marked failed (so it never
    dangles as forever-pending) and a sanitized 502 is returned.
    """
    resolved_project_id = _resolve_project_id(project_id, body)

    # Validate the project exists BEFORE creating the job. Otherwise a bogus id
    # would either raise a FK IntegrityError on PostgreSQL (surfacing as an opaque
    # 500) or — on SQLite, where FKs are off — silently enqueue a job for a
    # nonexistent project. An explicit 422 is correct + consistent on both.
    if await db.get(Project, resolved_project_id) is None:
        raise HTTPException(status_code=422, detail="project_id does not exist")

    job = await create_index_job(db, resolved_project_id)
    try:
        enqueue_index_job(job.id)
    except Exception as e:
        # The job row exists but could not be queued (e.g. Redis unreachable).
        # Mark it failed so it is not stuck PENDING forever. The 502 detail is a
        # FIXED message — the enqueue exception (a Redis connection error) can
        # carry the broker URL incl. credentials, and safe_error only bounds, it
        # does NOT strip secrets — so we never echo it to the client. The cause
        # is logged server-side (sanitized) for diagnosis.
        logger.warning("Index job enqueue failed: %s", safe_error(e))
        job.status = JobStatus.FAILED
        job.error_message = "A feladat sorba állítása nem sikerült."
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not enqueue index job (queue unavailable).",
        )
    return GenerationJobRead.model_validate(job)


@router.post("/chapters/{chapter_id}/summarize", response_model=AIResult)
async def summarize_chapter(
    chapter_id: uuid.UUID,
    data: SummarizeRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    svc: AIService = Depends(get_ai_service),
) -> AIResult:
    try:
        revision, job = await svc.summarize(
            db,
            content=data.content,
            content_type="fejezet",
            chapter_id=chapter_id,
            model=data.model,
            temperature=data.temperature,
            max_tokens=data.max_tokens,
        )
        return AIResult(
            revision=RevisionRead.model_validate(revision),
            job=GenerationJobRead.model_validate(job),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI generation failed: {safe_error(e)}",
        )
