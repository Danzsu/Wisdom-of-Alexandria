import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.deps import get_current_user, get_db
from app.core.errors import safe_error
from app.schemas.generation_job import GenerationJobRead
from app.schemas.revision import RevisionRead
from app.services.ai_service import DESCRIBE_CHANNELS, AIService, ai_service
from app.services.crud_provider import list_providers
from app.services.provider_service import list_provider_models

router = APIRouter(prefix="/ai", tags=["ai"])


def get_ai_service() -> AIService:
    return ai_service


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


class RewriteRequest(BaseModel):
    selected_text: str
    instruction: str
    scene_id: uuid.UUID | None = None
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


class DescribeRequest(BaseModel):
    selected_text: str
    channels: list[str] | None = None  # defaults to all 6 in AIService
    scene_id: uuid.UUID | None = None
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


class WriteContinueRequest(BaseModel):
    scene_text: str
    context: str = ""
    word_count_target: int = 300
    scene_id: uuid.UUID | None = None
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


class GenerateSceneRequest(BaseModel):
    beats: list[str]
    characters: str = ""
    location: str = ""
    style_notes: str = ""
    scene_id: uuid.UUID | None = None
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


class SummarizeRequest(BaseModel):
    content: str
    content_type: str = "jelenet"
    scene_id: uuid.UUID | None = None
    chapter_id: uuid.UUID | None = None
    model: str | None = None
    temperature: float | None = _TemperatureField
    max_tokens: int | None = _MaxTokensField


# ── Response schemas ─────────────────────────────────────────────────────────

class AIResult(BaseModel):
    revision: RevisionRead
    job: GenerationJobRead


class AIDescribeResult(BaseModel):
    revisions: list[RevisionRead]
    job: GenerationJobRead


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/rewrite", response_model=AIResult)
async def rewrite(
    data: RewriteRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
    svc: AIService = Depends(get_ai_service),
) -> AIResult:
    try:
        revision, job = await svc.rewrite(
            db,
            selected_text=data.selected_text,
            instruction=data.instruction,
            scene_id=data.scene_id,
            model=data.model,
            temperature=data.temperature,
            max_tokens=data.max_tokens,
        )
        return AIResult(revision=RevisionRead.model_validate(revision), job=GenerationJobRead.model_validate(job))
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
    if data.channels:
        invalid = [c for c in data.channels if c not in DESCRIBE_CHANNELS]
        if invalid:
            raise HTTPException(status_code=422, detail=f"Invalid channels: {invalid}")
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
        raise HTTPException(status_code=422, detail=str(e))
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
        revision, job = await svc.write_continue(
            db,
            scene_text=data.scene_text,
            context=data.context,
            word_count_target=data.word_count_target,
            scene_id=data.scene_id,
            model=data.model,
            temperature=data.temperature,
            max_tokens=data.max_tokens,
        )
        return AIResult(revision=RevisionRead.model_validate(revision), job=GenerationJobRead.model_validate(job))
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
        revision, job = await svc.generate_scene(
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
        return AIResult(revision=RevisionRead.model_validate(revision), job=GenerationJobRead.model_validate(job))
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
        return AIResult(revision=RevisionRead.model_validate(revision), job=GenerationJobRead.model_validate(job))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI generation failed: {safe_error(e)}",
        )


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
        return AIResult(revision=RevisionRead.model_validate(revision), job=GenerationJobRead.model_validate(job))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"AI generation failed: {safe_error(e)}",
        )
