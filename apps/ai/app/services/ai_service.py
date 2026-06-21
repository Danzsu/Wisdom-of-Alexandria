import json
import logging
import re
import uuid
from typing import Any

from alexandria_core.core.errors import safe_error
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.generation_job import GenerationJob
from alexandria_core.models.revision import Revision
from alexandria_core.models.scene import Scene
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.embedding_service import (
    EmbeddingService,
    RetrievedItem,
    embedding_service,
)
from app.services.model_router import ModelRouter, model_router
from app.services.prompt_loader import PromptLoader, prompt_loader
from app.services.revision_service import RevisionService, revision_service

logger = logging.getLogger(__name__)

DESCRIBE_CHANNELS = ["Látás", "Hang", "Tapintás", "Szag", "Íz", "Metaforák"]
PROMPT_VERSION = "1.0"

# Continuity warning severities. An out-of-range value from the model is clamped
# to CONTINUITY_DEFAULT_SEVERITY rather than dropped (the finding still matters).
CONTINUITY_SEVERITIES = ("info", "warning", "error")
CONTINUITY_DEFAULT_SEVERITY = "warning"

# A lenient "first JSON array" extractor for the tier-2 parse fallback (when the
# model wraps the array in prose or a ```json fence). Non-greedy, DOTALL so it
# spans newlines.
_JSON_ARRAY_RE = re.compile(r"\[.*\]", re.DOTALL)


def _coerce_warning(raw: Any) -> dict[str, Any] | None:
    """Validate/clamp one raw warning into the API contract shape, or drop it.

    - ``message`` is REQUIRED (a non-empty string) — a warning without it is
      meaningless, so it is dropped (returns ``None``).
    - ``severity`` is clamped to one of {info, warning, error}; anything else
      (or missing) becomes ``CONTINUITY_DEFAULT_SEVERITY`` — never dropped for a
      bad severity alone.
    - ``entity`` is optional; coerced to a trimmed string or ``None``.
    """
    if not isinstance(raw, dict):
        return None
    message = raw.get("message")
    if not isinstance(message, str) or not message.strip():
        return None
    severity = raw.get("severity")
    if not isinstance(severity, str) or severity not in CONTINUITY_SEVERITIES:
        severity = CONTINUITY_DEFAULT_SEVERITY
    entity = raw.get("entity")
    if isinstance(entity, str):
        entity = entity.strip() or None
    else:
        entity = None
    return {"severity": severity, "message": message.strip(), "entity": entity}


def _parse_continuity(content: str) -> list[dict[str, Any]] | None:
    """Parse a continuity LLM response into a list of warning dicts.

    Robust, two-tier parse:
      1. ``json.loads`` the whole response; accept it only if it is a list.
      2. If that fails (or isn't a list), extract the first ``[...]`` block via a
         lenient regex and ``json.loads`` that.

    Returns the validated/clamped warning list on success, or ``None`` when the
    response is genuinely unparseable as a warning array — the CALLER then
    degrades gracefully (a single visible warning + a logged WARNING). Returning
    ``None`` (vs an empty list) is deliberate: ``[]`` means "parsed fine, no
    issues found", whereas ``None`` means "could not parse" — the two must NOT be
    conflated (an unparseable response must never look like a clean check).
    """

    def _validate_list(data: Any) -> list[dict[str, Any]] | None:
        if not isinstance(data, list):
            return None
        out: list[dict[str, Any]] = []
        for item in data:
            coerced = _coerce_warning(item)
            if coerced is not None:
                out.append(coerced)
        return out

    # Tier 1: the whole response is JSON.
    try:
        parsed = _validate_list(json.loads(content))
        if parsed is not None:
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass

    # Tier 2: extract the first [...] block and parse that.
    match = _JSON_ARRAY_RE.search(content)
    if match is not None:
        try:
            parsed = _validate_list(json.loads(match.group(0)))
            if parsed is not None:
                return parsed
        except (json.JSONDecodeError, TypeError):
            pass

    # Tier 3 is the CALLER's responsibility (degrade to a visible warning).
    return None

# How many RAG snippets to inject per generation.
RAG_TOP_K = 5
# Bound the per-generation sync so a flaky/huge index can't stall a write.
RAG_SYNC_MAX_ITEMS = 200


def _format_context(items: list[RetrievedItem]) -> str:
    """Render retrieved entries into the prompt's ``{context}`` block."""
    if not items:
        return ""
    lines: list[str] = []
    for it in items:
        lines.append(f"- [{it.entity_type}] {it.label}: {it.snippet}")
    return "\n".join(lines)


def _context_entities(items: list[RetrievedItem]) -> list[dict[str, str]]:
    """Map retrieved entries to the API ``context_entities`` contract shape."""
    return [
        {"id": str(it.entity_id), "label": it.label, "entity_type": it.entity_type}
        for it in items
    ]


def _gen_overrides(
    temperature: float | None = None,
    max_tokens: int | None = None,
    *,
    default_max_tokens: int | None = None,
) -> dict[str, Any]:
    """Build kwargs for ``ModelRouter.complete`` from optional generation params.

    Only includes a key when a caller-supplied value exists, so that omitted
    params fall through to the router's own defaults. ``default_max_tokens``
    preserves an action's hardcoded ``max_tokens`` (e.g. summarize=512) when the
    caller does not override it.
    """
    overrides: dict[str, Any] = {}
    if temperature is not None:
        overrides["temperature"] = temperature
    if max_tokens is not None:
        overrides["max_tokens"] = max_tokens
    elif default_max_tokens is not None:
        overrides["max_tokens"] = default_max_tokens
    return overrides


class AIService:
    """Orchestrates AI generation tasks using ModelRouter and PromptLoader."""

    def __init__(
        self,
        router: ModelRouter | None = None,
        loader: PromptLoader | None = None,
        svc: RevisionService | None = None,
        embeddings: EmbeddingService | None = None,
    ):
        self.router = router or model_router
        self.loader = loader or prompt_loader
        self.svc = svc or revision_service
        self.embeddings = embeddings or embedding_service

    # ── RAG helpers ───────────────────────────────────────────────────────────

    async def _resolve_scope(
        self, db: AsyncSession, scene_id: uuid.UUID | None
    ) -> tuple[uuid.UUID | None, uuid.UUID | None]:
        """Resolve a scene's ``(project_id, series_id)`` (scene→chapter→book).

        ``project_id`` is the book's project; ``series_id`` is the owning book's
        series scope (NULL when the book is not in a series → project-global RAG
        only). Returns ``(None, None)`` when there is no ``scene_id`` or it cannot
        be resolved (deleted scene/chapter, or a scene with no chapter) — the
        caller then skips RAG gracefully. One query for both, so resolving the
        active series adds no extra round-trip.
        """
        if scene_id is None:
            return None, None
        from alexandria_core.models.book import Book

        row = (
            await db.execute(
                select(Book.project_id, Book.series_id)
                .select_from(Scene)
                .join(Chapter, Scene.chapter_id == Chapter.id)
                .join(Book, Chapter.book_id == Book.id)
                .where(Scene.id == scene_id)
            )
        ).one_or_none()
        if row is None:
            return None, None
        return row[0], row[1]

    async def _resolve_project_id(
        self, db: AsyncSession, scene_id: uuid.UUID | None
    ) -> uuid.UUID | None:
        """Resolve a scene's project (scene→chapter→book→project), or ``None``."""
        project_id, _ = await self._resolve_scope(db, scene_id)
        return project_id

    async def _resolve_series_id(
        self, db: AsyncSession, scene_id: uuid.UUID | None
    ) -> uuid.UUID | None:
        """Resolve the active series of a scene's book, or ``None`` (project-global).

        ``None`` means the book is not in a series (or the scene is unresolvable)
        — retrieval then sees only project-global embeddings, which is correct.
        """
        _, series_id = await self._resolve_scope(db, scene_id)
        return series_id

    async def _load_scene_content(
        self, db: AsyncSession, scene_id: uuid.UUID
    ) -> str | None:
        """Return a scene's ``content`` (the text to continuity-check), or ``None``.

        ``None`` when the scene does not exist OR has no/empty content — the
        caller (``check_continuity``) treats that as "nothing to check" and
        returns an empty result without an LLM call.
        """
        content = (
            await db.execute(select(Scene.content).where(Scene.id == scene_id))
        ).scalar_one_or_none()
        if content is None or not content.strip():
            return None
        return content

    async def _rag_context(
        self,
        db: AsyncSession,
        *,
        scene_id: uuid.UUID | None,
        query: str,
    ) -> tuple[str, list[RetrievedItem]]:
        """Build the ``{context}`` string + retrieved entities for a generation.

        Resolves the project AND active series from ``scene_id``, makes sure the
        index is fresh (bounded ``sync_project``) and retrieves the top-k nearest
        entries for ``query``, scoped to project-global + the book's series (never
        another series). Returns ``("", [])`` — i.e. degrades to no context —
        when:

        - there is no resolvable project (no/invalid ``scene_id``), or
        - no provider declares an embedding model (RAG unconfigured), or
        - the query is empty.

        RAG is a NON-fatal enhancement: any embedding/retrieval failure here is
        caught and logged as a WARNING, then degraded to no-context, so a flaky
        embedding provider never blocks the actual writing. This is deliberate
        (documented) graceful degradation, NOT a silently swallowed error.
        """
        if not query.strip():
            return "", []
        project_id, active_series_id = await self._resolve_scope(db, scene_id)
        if project_id is None:
            logger.debug("RAG skipped: no resolvable project for scene_id=%s", scene_id)
            return "", []
        model = await self.embeddings.resolve_embedding_model(db)
        if model is None:
            # Optional cloud embeddings not configured — expected, not an error.
            logger.debug("RAG skipped: no embedding model configured")
            return "", []
        try:
            # sync_project still indexes the WHOLE project (the index is
            # project-wide); only RETRIEVAL is series-scoped via active_series_id
            # (global OR the book's series — never another series).
            await self.embeddings.sync_project(
                db, project_id, embedding_model=model, max_items=RAG_SYNC_MAX_ITEMS
            )
            items = await self.embeddings.retrieve(
                db,
                project_id,
                query,
                embedding_model=model,
                k=RAG_TOP_K,
                active_series_id=active_series_id,
            )
        except Exception as e:  # noqa: BLE001 — degrade, don't crash the write
            # Roll back so the generation's own commits run on a clean session.
            await db.rollback()
            logger.warning(
                "RAG retrieval failed for project %s; continuing with no context: %s",
                project_id,
                safe_error(e),
            )
            return "", []
        return _format_context(items), items

    async def rewrite(
        self,
        db: AsyncSession,
        *,
        selected_text: str,
        instruction: str,
        scene_id: uuid.UUID | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[Revision, GenerationJob, list[dict[str, str]]]:
        # RAG context resolved BEFORE the job so a retrieval failure (which only
        # degrades to no-context) never leaves a dangling RUNNING job. Query =
        # the selected text + the instruction.
        context, retrieved = await self._rag_context(
            db, scene_id=scene_id, query=f"{selected_text}\n{instruction}"
        )
        job = await self.svc.create_job(
            db,
            job_type="rewrite",
            scene_id=scene_id,
            model_name=model,
            prompt_version=PROMPT_VERSION,
            input_data={"selected_text": selected_text, "instruction": instruction},
        )
        try:
            system = self.loader.load_system("rewrite")
            user = self.loader.load_user(
                "rewrite",
                selected_text=selected_text,
                instruction=instruction,
                context=context,
            )
            response = await self.router.complete(
                messages=self.router.build_messages(system, user),
                model=model,
                db=db,
                **_gen_overrides(temperature, max_tokens),
            )
            revision = await self.svc.save_revision(
                db,
                content=response.content,
                revision_type="rewrite",
                scene_id=scene_id,
                job_id=job.id,
                model_name=response.model,
                prompt_version=PROMPT_VERSION,
            )
            await self.svc.complete_job(db, job, output_data={"revision_id": str(revision.id)})
            return revision, job, _context_entities(retrieved)
        except Exception as e:
            # Roll back any partial / failed transaction so fail_job's commit
            # runs on a clean session (avoids PendingRollbackError masking the
            # original error). Then persist a sanitized, bounded error message.
            await db.rollback()
            await self.svc.fail_job(db, job, error_message=safe_error(e))
            raise

    async def describe(
        self,
        db: AsyncSession,
        *,
        selected_text: str,
        channels: list[str] | None = None,
        scene_id: uuid.UUID | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[list[Revision], GenerationJob]:
        """Generate sensory description for each requested channel."""
        target_channels = channels or DESCRIBE_CHANNELS
        # Validate channels
        invalid = [c for c in target_channels if c not in DESCRIBE_CHANNELS]
        if invalid:
            raise ValueError(f"Invalid channels: {invalid}. Valid: {DESCRIBE_CHANNELS}")

        job = await self.svc.create_job(
            db,
            job_type="describe",
            scene_id=scene_id,
            model_name=model,
            prompt_version=PROMPT_VERSION,
            input_data={"selected_text": selected_text, "channels": target_channels},
        )
        try:
            system = self.loader.load_system("describe")
            revisions = []
            for channel in target_channels:
                user = self.loader.load_user(
                    "describe", selected_text=selected_text, channel=channel
                )
                response = await self.router.complete(
                    messages=self.router.build_messages(system, user),
                    model=model,
                    db=db,
                    **_gen_overrides(temperature, max_tokens),
                )
                rev = await self.svc.save_revision(
                    db,
                    content=response.content,
                    revision_type="describe_channel",
                    scene_id=scene_id,
                    job_id=job.id,
                    model_name=response.model,
                    prompt_version=PROMPT_VERSION,
                )
                revisions.append(rev)
            await self.svc.complete_job(
                db, job, output_data={"revision_ids": [str(r.id) for r in revisions]}
            )
            return revisions, job
        except Exception as e:
            # Roll back any partial / failed transaction so fail_job's commit
            # runs on a clean session (avoids PendingRollbackError masking the
            # original error). Then persist a sanitized, bounded error message.
            await db.rollback()
            await self.svc.fail_job(db, job, error_message=safe_error(e))
            raise

    async def write_continue(
        self,
        db: AsyncSession,
        *,
        scene_text: str,
        context: str = "",
        word_count_target: int = 300,
        scene_id: uuid.UUID | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[Revision, GenerationJob, list[dict[str, str]]]:
        # Query = the TAIL of the scene (most recent context drives "what's next").
        rag_context, retrieved = await self._rag_context(
            db, scene_id=scene_id, query=scene_text[-1500:]
        )
        # Merge any caller-supplied context with the retrieved RAG block.
        full_context = "\n".join(p for p in (context, rag_context) if p.strip())
        job = await self.svc.create_job(
            db,
            job_type="write_continue",
            scene_id=scene_id,
            model_name=model,
            prompt_version=PROMPT_VERSION,
            input_data={"scene_text": scene_text, "word_count_target": word_count_target},
        )
        try:
            system = self.loader.load_system("write_continue")
            user = self.loader.load_user(
                "write_continue",
                scene_text=scene_text,
                context=full_context,
                word_count_target=str(word_count_target),
            )
            response = await self.router.complete(
                messages=self.router.build_messages(system, user),
                model=model,
                db=db,
                **_gen_overrides(temperature, max_tokens, default_max_tokens=word_count_target * 3),
            )
            revision = await self.svc.save_revision(
                db,
                content=response.content,
                revision_type="write_continue",
                scene_id=scene_id,
                job_id=job.id,
                model_name=response.model,
                prompt_version=PROMPT_VERSION,
            )
            await self.svc.complete_job(db, job, output_data={"revision_id": str(revision.id)})
            return revision, job, _context_entities(retrieved)
        except Exception as e:
            # Roll back any partial / failed transaction so fail_job's commit
            # runs on a clean session (avoids PendingRollbackError masking the
            # original error). Then persist a sanitized, bounded error message.
            await db.rollback()
            await self.svc.fail_job(db, job, error_message=safe_error(e))
            raise

    async def generate_scene(
        self,
        db: AsyncSession,
        *,
        beats: list[str],
        characters: str = "",
        location: str = "",
        style_notes: str = "",
        scene_id: uuid.UUID | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[Revision, GenerationJob, list[dict[str, str]]]:
        beats_text = "\n".join(f"- {b}" for b in beats)
        # Query = beats + named characters + location (what the scene is about).
        rag_query = "\n".join(p for p in (beats_text, characters, location) if p.strip())
        context, retrieved = await self._rag_context(
            db, scene_id=scene_id, query=rag_query
        )
        job = await self.svc.create_job(
            db,
            job_type="generate_scene",
            scene_id=scene_id,
            model_name=model,
            prompt_version=PROMPT_VERSION,
            input_data={"beats": beats, "characters": characters, "location": location},
        )
        try:
            system = self.loader.load_system("generate_scene")
            user = self.loader.load_user(
                "generate_scene",
                beats=beats_text,
                characters=characters,
                location=location,
                style_notes=style_notes,
                context=context,
            )
            response = await self.router.complete(
                messages=self.router.build_messages(system, user),
                model=model,
                db=db,
                **_gen_overrides(temperature, max_tokens, default_max_tokens=4096),
            )
            revision = await self.svc.save_revision(
                db,
                content=response.content,
                revision_type="generate_scene",
                scene_id=scene_id,
                job_id=job.id,
                model_name=response.model,
                prompt_version=PROMPT_VERSION,
            )
            await self.svc.complete_job(db, job, output_data={"revision_id": str(revision.id)})
            return revision, job, _context_entities(retrieved)
        except Exception as e:
            # Roll back any partial / failed transaction so fail_job's commit
            # runs on a clean session (avoids PendingRollbackError masking the
            # original error). Then persist a sanitized, bounded error message.
            await db.rollback()
            await self.svc.fail_job(db, job, error_message=safe_error(e))
            raise

    async def summarize(
        self,
        db: AsyncSession,
        *,
        content: str,
        content_type: str = "jelenet",
        scene_id: uuid.UUID | None = None,
        chapter_id: uuid.UUID | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[Revision, GenerationJob]:
        job = await self.svc.create_job(
            db,
            job_type="summarize",
            scene_id=scene_id,
            chapter_id=chapter_id,
            model_name=model,
            prompt_version=PROMPT_VERSION,
            input_data={"content_type": content_type},
        )
        try:
            system = self.loader.load_system("summarize")
            user = self.loader.load_user("summarize", content=content, content_type=content_type)
            response = await self.router.complete(
                messages=self.router.build_messages(system, user),
                model=model,
                db=db,
                **_gen_overrides(temperature, max_tokens, default_max_tokens=512),
            )
            revision = await self.svc.save_revision(
                db,
                content=response.content,
                revision_type="summarize",
                scene_id=scene_id,
                job_id=job.id,
                model_name=response.model,
                prompt_version=PROMPT_VERSION,
            )
            await self.svc.complete_job(db, job, output_data={"revision_id": str(revision.id)})
            return revision, job
        except Exception as e:
            # Roll back any partial / failed transaction so fail_job's commit
            # runs on a clean session (avoids PendingRollbackError masking the
            # original error). Then persist a sanitized, bounded error message.
            await db.rollback()
            await self.svc.fail_job(db, job, error_message=safe_error(e))
            raise

    async def check_continuity(
        self,
        db: AsyncSession,
        *,
        scene_id: uuid.UUID,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[list[dict[str, Any]], GenerationJob | None, list[dict[str, str]]]:
        """Continuity-check a scene against the project codex.

        ANALYSIS, not generation: this creates a ``GenerationJob(job_type=
        "continuity")`` and returns structured warnings, but NEVER a Revision
        (there is no generated content to approve).

        Flow:
          1. Load the scene's ``content``. No scene / empty content → return an
             empty result (no warnings, no job, no LLM call) — there is nothing
             to check. This is the documented "bad/empty scene" contract.
          2. RAG-retrieve the project codex context (reusing ``_rag_context``).
             When RAG is unconfigured the check STILL runs with empty context —
             it works on the scene text alone (graceful degradation, not a 500).
          3. Run the continuity prompt and parse the response ROBUSTLY
             (``_parse_continuity``: json → lenient-regex → ``None``). An
             unparseable response DEGRADES to a single ``warning`` item (+ a
             logged WARNING) — never a crash, never a silently-swallowed empty.
          4. A real LLM/infra error fails the job + re-raises (NOT masked by the
             parse fallback — only a *parse* failure degrades; an *infra* failure
             is loud).

        Returns ``(warnings, job, context_entities)``.
        """
        content = await self._load_scene_content(db, scene_id)
        if content is None:
            # Nothing to check — no scene/empty content. Empty result, no LLM
            # call, no job. (Documented: the endpoint surfaces an empty result.)
            logger.debug("Continuity skipped: no scene/content for scene_id=%s", scene_id)
            return [], None, []

        # Query the codex with the scene text itself (what the scene is about).
        context, retrieved = await self._rag_context(
            db, scene_id=scene_id, query=content
        )

        job = await self.svc.create_job(
            db,
            job_type="continuity",
            scene_id=scene_id,
            model_name=model,
            prompt_version=PROMPT_VERSION,
            input_data={"scene_id": str(scene_id)},
        )
        try:
            system = self.loader.load_system("continuity_check")
            user = self.loader.load_user(
                "continuity_check",
                codex_context=context,
                content=content,
            )
            response = await self.router.complete(
                messages=self.router.build_messages(system, user),
                model=model,
                db=db,
                **_gen_overrides(temperature, max_tokens),
            )
        except Exception as e:
            # A REAL LLM/infra error — roll back for a clean fail_job commit, then
            # re-raise. This must NOT be masked by the parse fallback below: only
            # an unparseable *response* degrades; an infra failure stays loud.
            await db.rollback()
            await self.svc.fail_job(db, job, error_message=safe_error(e))
            raise

        warnings = _parse_continuity(response.content)
        if warnings is None:
            # Tier-3 graceful degradation: the model answered, but we could not
            # parse it as a warning array. Surface a SINGLE visible warning (the
            # user sees the check ran but its output was unusable) and LOG it.
            # NOT a crash, NOT a silently-swallowed empty list.
            logger.warning(
                "Continuity output could not be parsed for scene %s: %s",
                scene_id,
                safe_error(response.content),
            )
            warnings = [
                {
                    "severity": "warning",
                    "message": (
                        "A folytonosság-ellenőrzés eredménye nem volt feldolgozható. "
                        "Próbáld újra, vagy ellenőrizd a szöveget kézzel."
                    ),
                    "entity": None,
                }
            ]

        # complete_job runs on its own; a parse-degradation is still a COMPLETED
        # analysis (the call succeeded, the output was just unusable).
        await self.svc.complete_job(
            db, job, output_data={"warning_count": len(warnings)}
        )
        return warnings, job, _context_entities(retrieved)


ai_service = AIService()
