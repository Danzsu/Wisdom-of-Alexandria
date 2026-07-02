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
from app.services.progression_service import current_progressions_as_of_scene
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

# Default number of brainstorm ideas when the caller does not ask for a count.
BRAINSTORM_DEFAULT_COUNT = 5

# Bullet / numbering markers stripped from the front of a line in the tier-3
# brainstorm parse fallback ("- idea", "* idea", "3. idea", "4) idea", "• idea").
_IDEA_LINE_MARKER_RE = re.compile(r"^\s*(?:[-*•]+|\d+[.)])\s*")


def _coerce_idea(raw: Any) -> str | None:
    """Coerce one raw list item into an idea string, or drop it (``None``).

    Strings are trimmed (empty → dropped). Objects carrying an ``idea``/``text``
    string (a common model shape) yield that string. Anything else is junk and
    is dropped — a number or ``null`` must never surface as an "idea".
    """
    if isinstance(raw, str):
        return raw.strip() or None
    if isinstance(raw, dict):
        for key in ("idea", "text"):
            value = raw.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return None


def _parse_ideas(content: str) -> list[str] | None:
    """Parse a brainstorm LLM response into a list of idea strings.

    Robust, tiered parse (mirrors :func:`_parse_continuity`):
      1. ``json.loads`` the whole response; accept a list, or a dict wrapping the
         list under ``"ideas"``.
      2. If that fails, extract the first ``[...]`` block via the lenient regex
         and ``json.loads`` that.
      3. Plain-line fallback: split on newlines, strip bullet/number markers,
         keep non-empty lines — a non-JSON but line-per-idea answer still parses.

    Returns ``None`` when the response is genuinely unusable (whitespace-only,
    or every parsed item was junk) — the CALLER then degrades to a single
    visible fallback idea (+ a logged WARNING), mirroring the continuity tiers.
    """

    def _validate_list(data: Any) -> list[str] | None:
        if isinstance(data, dict):
            data = data.get("ideas")
        if not isinstance(data, list):
            return None
        out = [idea for idea in (_coerce_idea(item) for item in data) if idea]
        return out or None

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

    # Tier 3: plain-line fallback (bullet/number markers stripped).
    lines = [_IDEA_LINE_MARKER_RE.sub("", line).strip() for line in content.splitlines()]
    ideas = [line for line in lines if line]
    return ideas or None


# How many RAG snippets to inject per generation.
RAG_TOP_K = 5
# Bound the per-generation sync so a flaky/huge index can't stall a write.
RAG_SYNC_MAX_ITEMS = 200


def _format_context(
    items: list[RetrievedItem],
    progression_notes: dict[tuple[str, uuid.UUID], str] | None = None,
) -> str:
    """Render retrieved entries into the prompt's ``{context}`` block.

    When ``progression_notes`` maps an entry's ``(entity_type, entity_id)`` to a
    non-empty "state as of the target scene" note, that note is appended to the
    entry's line so the writer/reviewer sees the entity's CURRENT state (never a
    future / spoiler state — the note is pre-filtered to ``<=`` S by
    :func:`current_progressions_as_of_scene`).
    """
    if not items:
        return ""
    progression_notes = progression_notes or {}
    lines: list[str] = []
    for it in items:
        line = f"- [{it.entity_type}] {it.label}: {it.snippet}"
        note = progression_notes.get((it.entity_type, it.entity_id))
        if note and note.strip():
            line += f" (állapot a jelenetig: {note.strip()})"
        lines.append(line)
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
        return await self._retrieve_context(
            db,
            project_id=project_id,
            active_series_id=active_series_id,
            query=query,
            scene_id=scene_id,
        )

    async def _retrieve_context(
        self,
        db: AsyncSession,
        *,
        project_id: uuid.UUID,
        active_series_id: uuid.UUID | None,
        query: str,
        scene_id: uuid.UUID | None = None,
    ) -> tuple[str, list[RetrievedItem]]:
        """Shared RAG core: bounded project sync + series-scoped top-k retrieve.

        Used by both scene-scoped generation (``_rag_context``) and project-scoped
        Q&A (``research``). Degrades to ``("", [])`` — logged, never crashed — when
        no embedding provider is configured or any embedding/retrieval call fails;
        a flaky provider must never block the feature that called it.

        When a ``scene_id`` is supplied, each retrieved entry is annotated with its
        CodexProgression "state as of that scene" (latest progression at-or-before
        the scene in story order) so the prompt reflects the entity's current —
        never future — state.
        """
        if not query.strip():
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
        except Exception as e:  # noqa: BLE001 — degrade, don't crash the caller
            # Roll back so the caller's own commits run on a clean session.
            await db.rollback()
            logger.warning(
                "RAG retrieval failed for project %s; continuing with no context: %s",
                project_id,
                safe_error(e),
            )
            return "", []
        progression_notes = await self._progression_notes(db, scene_id, items)
        return _format_context(items, progression_notes), items

    async def _progression_notes(
        self,
        db: AsyncSession,
        scene_id: uuid.UUID | None,
        items: list[RetrievedItem],
    ) -> dict[tuple[str, uuid.UUID], str]:
        """Map each retrieved entry to its progression note current as-of ``scene_id``.

        Returns ``{}`` when there is no scene context or no items. Progression
        annotation is a NON-fatal enhancement: any failure here is caught, logged
        as a WARNING (never silent), and degraded to no annotation so a progression
        glitch never blocks the actual writing — mirroring RAG's own degradation.
        """
        if scene_id is None or not items:
            return {}
        entities = [(it.entity_type, it.entity_id) for it in items]
        try:
            states = await current_progressions_as_of_scene(
                db, scene_id=scene_id, entities=entities
            )
        except Exception as e:  # noqa: BLE001 — degrade, don't crash the caller
            logger.warning(
                "Progression lookup failed for scene %s; continuing without "
                "progression state: %s",
                scene_id,
                safe_error(e),
            )
            return {}
        return {
            (s.entity_type, s.entity_id): s.note
            for s in states
            if s.note and s.note.strip()
        }

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

    async def _transform_selection(
        self,
        db: AsyncSession,
        *,
        action: str,
        selected_text: str,
        guidance: str = "",
        scene_id: uuid.UUID | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[Revision, GenerationJob, list[dict[str, str]]]:
        """Shared HITL selection-transform core for ``expand`` / ``compress``.

        Mirrors ``rewrite`` exactly: progression-aware scene-scoped RAG → the
        ``action``-named template → ``ModelRouter.complete`` → an unapproved
        ``Revision(revision_type=action)`` linked to a ``GenerationJob(job_type=
        action)``. ``action`` doubles as the template name, the job_type and the
        revision_type so producer + consumer can never drift apart.
        """
        # RAG context resolved BEFORE the job so a retrieval failure (which only
        # degrades to no-context) never leaves a dangling RUNNING job.
        context, retrieved = await self._rag_context(
            db, scene_id=scene_id, query=f"{selected_text}\n{guidance}"
        )
        job = await self.svc.create_job(
            db,
            job_type=action,
            scene_id=scene_id,
            model_name=model,
            prompt_version=PROMPT_VERSION,
            input_data={"selected_text": selected_text, "guidance": guidance},
        )
        try:
            system = self.loader.load_system(action)
            user = self.loader.load_user(
                action,
                selected_text=selected_text,
                guidance=guidance,
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
                revision_type=action,
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

    async def expand(
        self,
        db: AsyncSession,
        *,
        selected_text: str,
        guidance: str = "",
        scene_id: uuid.UUID | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[Revision, GenerationJob, list[dict[str, str]]]:
        """Expand a selection (sensory detail / interiority, voice preserved).

        HITL like ``rewrite``: returns an unapproved ``Revision(revision_type=
        "expand")`` linked to a ``GenerationJob(job_type="expand")`` — never
        auto-applies.
        """
        return await self._transform_selection(
            db,
            action="expand",
            selected_text=selected_text,
            guidance=guidance,
            scene_id=scene_id,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    async def compress(
        self,
        db: AsyncSession,
        *,
        selected_text: str,
        guidance: str = "",
        scene_id: uuid.UUID | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[Revision, GenerationJob, list[dict[str, str]]]:
        """Tighten a selection (cut filler, keep meaning + voice).

        HITL like ``rewrite``: returns an unapproved ``Revision(revision_type=
        "compress")`` linked to a ``GenerationJob(job_type="compress")``.
        """
        return await self._transform_selection(
            db,
            action="compress",
            selected_text=selected_text,
            guidance=guidance,
            scene_id=scene_id,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )

    async def brainstorm(
        self,
        db: AsyncSession,
        *,
        topic: str,
        scene_id: uuid.UUID | None = None,
        count: int = BRAINSTORM_DEFAULT_COUNT,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[list[str], GenerationJob | None, list[dict[str, str]]]:
        """Brainstorm story ideas grounded on the Codex/manuscript (ötletelés).

        ANALYSIS-like output, not manuscript text: creates a ``GenerationJob(
        job_type="brainstorm")`` for provenance and returns ``(ideas, job,
        context_entities)`` — NEVER a Revision (there is nothing to approve or
        insert; the writer picks an idea and writes it themselves).

        Flow mirrors ``research``:
          1. Empty/whitespace topic → empty result, no LLM call, no job.
          2. Scene-scoped RAG (when ``scene_id`` is given). RAG unconfigured →
             the model still brainstorms from the topic alone (never a 500).
          3. The response is parsed ROBUSTLY (``_parse_ideas``: json →
             lenient-regex → line-split). An unusable response DEGRADES to a
             single visible fallback idea (+ a logged WARNING) — never a crash,
             never a silently-empty list. The list is truncated to ``count``.
          4. A real LLM/infra error fails the job + re-raises (stays loud).
        """
        if not topic.strip():
            return [], None, []
        context, retrieved = await self._rag_context(db, scene_id=scene_id, query=topic)
        job = await self.svc.create_job(
            db,
            job_type="brainstorm",
            scene_id=scene_id,
            model_name=model,
            prompt_version=PROMPT_VERSION,
            input_data={"topic": topic[:500], "count": count},
        )
        try:
            system = self.loader.load_system("brainstorm")
            user = self.loader.load_user(
                "brainstorm", topic=topic, count=str(count), context=context
            )
            response = await self.router.complete(
                messages=self.router.build_messages(system, user),
                model=model,
                db=db,
                **_gen_overrides(temperature, max_tokens),
            )
        except Exception as e:
            # Real LLM/infra error — roll back for a clean fail_job commit, then
            # re-raise. NOT masked by the parse fallback below: only an
            # unusable *response* degrades; an infra failure stays loud.
            await db.rollback()
            await self.svc.fail_job(db, job, error_message=safe_error(e))
            raise

        ideas = _parse_ideas(response.content)
        if not ideas:
            # Tiered graceful degradation: the model answered, but the output
            # was unusable as an idea list. Surface ONE visible fallback idea
            # (the user sees the call ran but produced nothing usable) and LOG
            # it — not a crash, not a silently-swallowed empty list.
            logger.warning(
                "Brainstorm output could not be parsed for scene %s: %s",
                scene_id,
                safe_error(response.content),
            )
            ideas = [
                "Az ötletelés eredménye nem volt feldolgozható. "
                "Próbáld újra, vagy fogalmazd át a témát."
            ]
        ideas = ideas[:count]
        # A parse-degradation is still a COMPLETED brainstorm (the call
        # succeeded). Ideas live in output_data — the job IS the provenance
        # record, there is no Revision.
        await self.svc.complete_job(db, job, output_data={"ideas": ideas})
        return ideas, job, _context_entities(retrieved)

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

    async def generate_scene_revision(
        self,
        db: AsyncSession,
        *,
        scene: "Scene | uuid.UUID | None",
        beats: list[str],
        characters: str = "",
        location: str = "",
        style_notes: str = "",
        job_id: uuid.UUID | None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[Revision, list[dict[str, str]]]:
        """Generate one scene's draft as an unapproved Revision linked to ``job_id``.

        This is the REUSABLE per-scene generation core: RAG (progression-aware,
        scene-scoped) → prompt assembly → ``ModelRouter.complete`` →
        ``save_revision(approved=False, …, job_id=job_id)``. It RETURNS the
        Revision plus the retrieved ``context_entities`` (a ``(Revision, list)``
        tuple, so the single-scene endpoint keeps its grounding contract without a
        second RAG pass; a chapter job just unpacks the Revision) and deliberately
        does
        NOT create, complete, or fail any ``GenerationJob`` — the owning job is
        the caller's responsibility, so a parent chapter job can link many scenes'
        revisions to a single job.

        ``scene`` may be a ``Scene`` ORM object, a bare scene ``uuid.UUID``, or
        ``None``; its id (when present) drives the progression-aware, scene-scoped
        RAG context exactly as the single-scene path does.
        """
        scene_id = getattr(scene, "id", scene)
        beats_text = "\n".join(f"- {b}" for b in beats)
        # Query = beats + named characters + location (what the scene is about).
        rag_query = "\n".join(p for p in (beats_text, characters, location) if p.strip())
        context, retrieved = await self._rag_context(
            db, scene_id=scene_id, query=rag_query
        )
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
            job_id=job_id,
            model_name=response.model,
            prompt_version=PROMPT_VERSION,
        )
        return revision, _context_entities(retrieved)

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
        job = await self.svc.create_job(
            db,
            job_type="generate_scene",
            scene_id=scene_id,
            model_name=model,
            prompt_version=PROMPT_VERSION,
            input_data={"beats": beats, "characters": characters, "location": location},
        )
        try:
            revision, context_entities = await self.generate_scene_revision(
                db,
                scene=scene_id,
                beats=beats,
                characters=characters,
                location=location,
                style_notes=style_notes,
                job_id=job.id,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            await self.svc.complete_job(db, job, output_data={"revision_id": str(revision.id)})
            return revision, job, context_entities
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

        job = await self.svc.create_job(
            db,
            job_type="continuity",
            scene_id=scene_id,
            model_name=model,
            prompt_version=PROMPT_VERSION,
            input_data={"scene_id": str(scene_id)},
        )
        try:
            warnings, retrieved = await self.analyze_continuity_text(
                db,
                scene_id=scene_id,
                content=content,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except Exception as e:
            # A REAL LLM/infra error — roll back for a clean fail_job commit, then
            # re-raise. This must NOT be masked by the parse fallback (which lives
            # inside analyze_continuity_text): only an unparseable *response*
            # degrades there; an infra failure propagates out and stays loud.
            await db.rollback()
            await self.svc.fail_job(db, job, error_message=safe_error(e))
            raise

        # complete_job runs on its own; a parse-degradation is still a COMPLETED
        # analysis (the call succeeded, the output was just unusable).
        await self.svc.complete_job(
            db, job, output_data={"warning_count": len(warnings)}
        )
        return warnings, job, _context_entities(retrieved)

    async def analyze_continuity_text(
        self,
        db: AsyncSession,
        *,
        scene_id: uuid.UUID | None,
        content: str,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[list[dict[str, Any]], list[RetrievedItem]]:
        """Continuity-check ARBITRARY ``content`` against the project codex.

        The REUSABLE continuity core: scene-scoped RAG (``scene_id`` drives the
        project/series scope + progression annotation) → continuity prompt →
        ``ModelRouter.complete`` → the robust two-tier parse. Returns
        ``(warnings, retrieved)`` and deliberately creates NO ``GenerationJob`` —
        the owning job (if any) is the caller's responsibility, so:

        - the standalone ``check_continuity`` endpoint wraps it in its own
          ``continuity`` job (checking the SAVED ``scene.content``), and
        - a chapter-generation job can check the JUST-GENERATED revision text
          (which is NOT yet in ``scene.content`` — HITL) WITHOUT spawning an
          orphan child job per scene.

        An unparseable model response DEGRADES to a single visible ``warning`` (+
        a logged WARNING), never a crash, never a silently-swallowed empty list. A
        real LLM/infra error PROPAGATES (the caller decides how to record it).
        """
        # Query the codex with the content itself (what the scene is about).
        context, retrieved = await self._rag_context(
            db, scene_id=scene_id, query=content
        )
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
        return warnings, retrieved

    async def research(
        self,
        db: AsyncSession,
        *,
        question: str,
        project_id: uuid.UUID,
        scene_id: uuid.UUID | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[str, GenerationJob | None, list[dict[str, str]]]:
        """Answer a free-form question grounded on the project's Codex + manuscript.

        ANALYSIS, not generation: creates a ``GenerationJob(job_type="research")``
        and returns ``(answer, job, context_entities)`` — NEVER a Revision (there
        is nothing to insert into the manuscript).

        Flow mirrors ``check_continuity``:
          1. Empty question → empty result, no LLM call, no job.
          2. Project-scoped RAG retrieval (series-scoped when a ``scene_id`` gives
             a book context). When RAG is unconfigured the answer STILL runs with
             empty context (graceful degradation — the model just has less to go
             on), never a 500.
          3. A real LLM/infra error fails the job + re-raises (stays loud).
        """
        if not question.strip():
            return "", None, []

        # Series scope (optional): if the caller is in a scene/book context, scope
        # retrieval to project-global + that book's series; otherwise project-wide.
        active_series_id = await self._resolve_series_id(db, scene_id)
        context, retrieved = await self._retrieve_context(
            db,
            project_id=project_id,
            active_series_id=active_series_id,
            query=question,
            scene_id=scene_id,
        )

        job = await self.svc.create_job(
            db,
            job_type="research",
            project_id=project_id,
            scene_id=scene_id,
            model_name=model,
            prompt_version=PROMPT_VERSION,
            input_data={"question": question[:500]},
        )
        try:
            system = self.loader.load_system("research")
            user = self.loader.load_user(
                "research", codex_context=context, question=question
            )
            response = await self.router.complete(
                messages=self.router.build_messages(system, user),
                model=model,
                db=db,
                **_gen_overrides(temperature, max_tokens),
            )
        except Exception as e:
            # Real LLM/infra error — roll back for a clean fail_job commit, re-raise.
            await db.rollback()
            await self.svc.fail_job(db, job, error_message=safe_error(e))
            raise

        answer = response.content.strip()
        await self.svc.complete_job(
            db, job, output_data={"answered": bool(answer)}
        )
        return answer, job, _context_entities(retrieved)


ai_service = AIService()
