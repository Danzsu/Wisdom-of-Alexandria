"""RAG indexing + retrieval (B2b).

The :class:`EmbeddingService` keeps a project's :class:`Embedding` rows in sync
with its source content and answers similarity queries over them.

Scope is the **PROJECT** (see ``Embedding`` docstring): a generation in any book
of project P draws on P's whole codex (project-scoped) plus the project's
manuscript (scene/chapter, book-scoped). So both :meth:`sync_project` and
:meth:`retrieve` take a ``project_id``.

Design notes / guarantees:

- **Idempotent / hash-cached.** Each indexable row's source text is hashed
  (sha256); if the stored ``Embedding.content_hash`` already matches, the row is
  left untouched (NO re-embed). Only missing/changed content is embedded.
- **AI visibility.** ``ai_visible=False`` codex-family entities are never
  indexed, and an existing embedding for one is deleted when the flag flips.
  ``retrieve`` ALSO re-filters ``ai_visible`` defensively at query time.
- **Reconciliation.** Entities that disappeared (hard-deleted, or no longer
  indexable) have their stale embeddings removed for the scanned types.
- **Bounded.** ``sync_project`` caps how many embeddings it writes per run
  (``max_items``) and logs once when it hits the cap, so a huge project can't
  trigger an unbounded embedding spend in a single call.
- **Graceful degradation.** Cloud embeddings are optional. When no enabled
  provider declares an ``embedding_model``, :meth:`resolve_embedding_model`
  returns ``None`` and callers skip retrieval with empty context (logged at
  INFO/DEBUG — NOT an error).

Similarity search uses ``cosine_distance`` (the ``<=>`` operator), which is
PostgreSQL-only; the ordering tests are ``@pytest.mark.postgres``.
"""

from __future__ import annotations

import hashlib
import logging
import uuid
from dataclasses import dataclass

from alexandria_core.db.vector import cosine_distance
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.character import Character
from alexandria_core.models.codex_entry import CodexEntry
from alexandria_core.models.embedding import Embedding
from alexandria_core.models.location import Location
from alexandria_core.models.scene import Scene
from alexandria_core.models.style_guide import StyleGuide
from alexandria_core.models.worldbuilding_entry import WorldbuildingEntry
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.crud_provider import get_embedding_provider
from app.services.model_router import ModelRouter, model_router

logger = logging.getLogger(__name__)

# Default ceiling on how many vectors a single sync run will (re)embed. Keeps a
# large project from triggering an unbounded embedding spend in one call.
DEFAULT_MAX_ITEMS = 500

# Max characters of a source field folded into the snippet returned by retrieve.
_SNIPPET_LEN = 400


@dataclass
class _Indexable:
    """One source row reduced to what the indexer needs."""

    entity_type: str
    entity_id: uuid.UUID
    label: str
    text: str
    book_id: uuid.UUID | None = None
    # Series scope (B3b): codex from ``CodexEntry.series_id``; scene/chapter from
    # the owning book's ``series_id``; project-global entities leave it NULL.
    series_id: uuid.UUID | None = None


@dataclass
class SyncResult:
    """Summary of a :meth:`sync_project` run (also the /ai/index response body)."""

    indexed: int = 0  # newly created embeddings
    updated: int = 0  # changed content re-embedded in place
    deleted: int = 0  # stale / hidden embeddings removed
    skipped: int = 0  # unchanged content (hash cache hit) — no re-embed
    capped: bool = False  # True if max_items stopped us short


@dataclass
class RetrievedItem:
    entity_type: str
    entity_id: uuid.UUID
    label: str
    snippet: str
    distance: float


def _hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _join(*parts: str | None) -> str:
    """Join the non-empty meaningful fields of an entity into one source text."""
    return "\n".join(p.strip() for p in parts if p and p.strip())


def _truncate(text: str, limit: int = _SNIPPET_LEN) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[:limit]


class EmbeddingService:
    """Indexes a project's RAG content and retrieves the top-k nearest entries."""

    def __init__(self, router: ModelRouter | None = None):
        self.router = router or model_router

    # ── Provider / model resolution ──────────────────────────────────────────

    async def resolve_embedding_model(self, db: AsyncSession) -> str | None:
        """Return the embedding model to use, or ``None`` if RAG is unconfigured.

        Cloud embeddings are optional; ``None`` means "no provider declares an
        embedding model" → callers degrade gracefully (skip RAG). Never raises
        for the unconfigured case.
        """
        provider = await get_embedding_provider(db)
        if provider is None or not provider.embedding_model:
            return None
        return provider.embedding_model

    # ── Gathering indexable source rows ──────────────────────────────────────

    async def _gather(self, db: AsyncSession, project_id: uuid.UUID) -> list[_Indexable]:
        """Collect every indexable row for the project as ``_Indexable`` items.

        Codex-family entities are included ONLY when ``ai_visible`` is True
        (hidden ones are excluded here and reconciled away below). Scenes/chapters
        carry ``book_id`` provenance (resolved via chapter→book / book).
        """
        items: list[_Indexable] = []

        # Codex entries (project-scoped, ai_visible gate).
        rows = (
            await db.execute(
                select(CodexEntry).where(
                    CodexEntry.project_id == project_id,
                    CodexEntry.ai_visible.is_(True),
                )
            )
        ).scalars().all()
        for r in rows:
            text = _join(r.title, r.role, r.content)
            if text:
                # Codex carries its own series scope (NULL = project-global).
                items.append(
                    _Indexable(
                        "codex", r.id, r.title or "Kódex", text,
                        series_id=r.series_id,
                    )
                )

        # Characters.
        rows = (
            await db.execute(
                select(Character).where(
                    Character.project_id == project_id,
                    Character.ai_visible.is_(True),
                )
            )
        ).scalars().all()
        for r in rows:
            text = _join(
                r.name, r.description, r.personality, r.backstory, r.appearance, r.notes
            )
            if text:
                items.append(
                    _Indexable("character", r.id, r.name or "Karakter", text)
                )

        # Locations.
        rows = (
            await db.execute(
                select(Location).where(
                    Location.project_id == project_id,
                    Location.ai_visible.is_(True),
                )
            )
        ).scalars().all()
        for r in rows:
            text = _join(r.name, r.description, r.geography, r.atmosphere, r.notes)
            if text:
                items.append(
                    _Indexable("location", r.id, r.name or "Helyszín", text)
                )

        # Worldbuilding.
        rows = (
            await db.execute(
                select(WorldbuildingEntry).where(
                    WorldbuildingEntry.project_id == project_id,
                    WorldbuildingEntry.ai_visible.is_(True),
                )
            )
        ).scalars().all()
        for r in rows:
            text = _join(r.name, r.category, r.description, r.notes)
            if text:
                items.append(
                    _Indexable("worldbuilding", r.id, r.name or "Világépítés", text)
                )

        # Style guide (one per project; no ai_visible flag — always project-level
        # guidance the writer agent should see).
        sg = (
            await db.execute(
                select(StyleGuide).where(StyleGuide.project_id == project_id)
            )
        ).scalar_one_or_none()
        if sg is not None:
            text = _join(sg.tone, sg.pov, sg.tense, sg.notes)
            if text:
                items.append(
                    _Indexable("styleguide", sg.id, "Stílusútmutató", text)
                )

        # Scenes (approved, post-HITL content + summary). Book-scoped: resolve the
        # owning book via chapter for provenance + the book's series scope.
        from alexandria_core.models.book import Book

        scene_rows = (
            await db.execute(
                select(Scene, Chapter.book_id, Book.series_id)
                .join(Chapter, Scene.chapter_id == Chapter.id)
                .join(Book, Chapter.book_id == Book.id)
                .where(Book.project_id == project_id)
            )
        ).all()
        for scene, book_id, series_id in scene_rows:
            text = _join(scene.title, scene.content, scene.summary)
            if text:
                items.append(
                    _Indexable(
                        "scene", scene.id, scene.title or "Jelenet", text,
                        book_id, series_id,
                    )
                )

        # Chapters (summary). Series scope = the owning book's series.
        chapter_rows = (
            await db.execute(
                select(Chapter, Book.series_id)
                .join(Book, Chapter.book_id == Book.id)
                .where(Book.project_id == project_id)
            )
        ).all()
        for ch, series_id in chapter_rows:
            text = _join(ch.title, ch.summary)
            if text:
                items.append(
                    _Indexable(
                        "chapter", ch.id, ch.title or "Fejezet", text,
                        ch.book_id, series_id,
                    )
                )

        return items

    # ── Sync ─────────────────────────────────────────────────────────────────

    async def sync_project(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        *,
        embedding_model: str,
        max_items: int = DEFAULT_MAX_ITEMS,
    ) -> SyncResult:
        """Reconcile the project's embeddings with its current source content.

        For each indexable row: hash the source text, compare to the stored
        ``content_hash`` — unchanged → skip (no re-embed); missing → create;
        changed → re-embed in place. Stale rows (entity gone or now hidden) for
        the scanned entity types are deleted. Bounded by ``max_items`` writes.

        ``embedding_model`` is required and must be resolved by the caller
        (``resolve_embedding_model``) — sync is only run when RAG is configured.
        """
        result = SyncResult()
        items = await self._gather(db, project_id)

        # Existing embeddings for this project, keyed by (entity_type, entity_id).
        existing_rows = (
            await db.execute(
                select(Embedding).where(Embedding.project_id == project_id)
            )
        ).scalars().all()
        existing: dict[tuple[str, uuid.UUID], Embedding] = {
            (e.entity_type, e.entity_id): e for e in existing_rows
        }
        live_keys: set[tuple[str, uuid.UUID]] = {
            (it.entity_type, it.entity_id) for it in items
        }

        # 1) Delete embeddings whose source is gone or no longer indexable
        #    (covers ai_visible flipped to False — such rows are absent from
        #    `items`). Only touch the entity types this indexer manages.
        for key, row in existing.items():
            if key not in live_keys:
                await db.delete(row)
                result.deleted += 1

        # 2) Upsert changed / new content, bounded by max_items.
        to_embed: list[_Indexable] = []
        for it in items:
            row = existing.get((it.entity_type, it.entity_id))
            content_hash = _hash(it.text)
            if row is not None and row.content_hash == content_hash and row.embedding is not None:
                # Hash-cache hit: identical content already embedded → no
                # re-embed. BUT scope can change without the text changing (e.g. a
                # codex entry moved to another series, or a book reassigned to a
                # series): reconcile the denormalized scope columns in place so a
                # stale ``series_id``/``book_id`` never persists and leak/exclude
                # the entry from the wrong series at query time. This is a cheap
                # metadata UPDATE (no embedding call), counted as `updated`.
                if row.series_id != it.series_id or row.book_id != it.book_id:
                    row.series_id = it.series_id
                    row.book_id = it.book_id
                    result.updated += 1
                else:
                    result.skipped += 1
                continue
            if len(to_embed) >= max_items:
                result.capped = True
                continue
            to_embed.append(it)

        if result.capped:
            logger.info(
                "sync_project: hit max_items=%s for project %s; %s item(s) "
                "left for a later run",
                max_items,
                project_id,
                len(items) - result.skipped - len(to_embed) - result.deleted,
            )

        if to_embed:
            # One batched embedding call for all changed/new texts. embed() guards
            # against a partial batch (raises if the provider returns fewer
            # vectors than inputs), so position-based mapping below is safe.
            vectors = await self.router.embed(
                [it.text for it in to_embed], model=embedding_model, db=db
            )
            dim = len(vectors[0]) if vectors else 0
            for it, vec in zip(to_embed, vectors, strict=True):
                content_hash = _hash(it.text)
                row = existing.get((it.entity_type, it.entity_id))
                if row is None:
                    db.add(
                        Embedding(
                            project_id=project_id,
                            book_id=it.book_id,
                            series_id=it.series_id,
                            entity_type=it.entity_type,
                            entity_id=it.entity_id,
                            content_hash=content_hash,
                            embedding=vec,
                            model_name=embedding_model,
                            dim=len(vec) or dim,
                        )
                    )
                    result.indexed += 1
                else:
                    row.content_hash = content_hash
                    row.embedding = vec
                    row.model_name = embedding_model
                    row.dim = len(vec) or dim
                    row.book_id = it.book_id
                    row.series_id = it.series_id
                    result.updated += 1

        await db.commit()
        return result

    # ── Retrieval ────────────────────────────────────────────────────────────

    async def retrieve(
        self,
        db: AsyncSession,
        project_id: uuid.UUID,
        query: str,
        *,
        embedding_model: str,
        k: int = 5,
        active_series_id: uuid.UUID | None = None,
    ) -> list[RetrievedItem]:
        """Return the ``k`` most cosine-similar project entries to ``query``.

        Embeds the query, orders the project's embeddings ascending by
        ``cosine_distance`` (0 = identical) and returns the top ``k``. The
        ``ai_visible`` flag is RE-CHECKED defensively against the live source
        rows, so a card hidden after indexing (but before the next sync) never
        leaks into context.

        Series scope (B3b): ``active_series_id`` is the series of the generation's
        book (resolved by the caller). The filter is
        ``series_id IS NULL OR series_id == active_series_id`` — i.e.
        project-global rows (``series_id`` NULL) PLUS the active series' rows,
        EXCLUDING every other series' codex and other series' books' manuscript.
        When ``active_series_id`` is ``None`` (the book is not in a series), only
        the project-global rows match — which is the correct behaviour.

        ``cosine_distance`` (``<=>``) is PostgreSQL-only; this query is exercised
        by the ``@pytest.mark.postgres`` ordering tests.
        """
        if not query.strip() or k <= 0:
            return []
        query_vec = (await self.router.embed([query], model=embedding_model, db=db))[0]

        # Series filter: global (NULL) OR the active series; never other series.
        series_filter = Embedding.series_id.is_(None)
        if active_series_id is not None:
            series_filter = series_filter | (Embedding.series_id == active_series_id)

        # Over-fetch a little so defensive ai_visible filtering still leaves k.
        rows = (
            await db.execute(
                select(
                    Embedding,
                    cosine_distance(Embedding.embedding, query_vec).label("distance"),
                )
                .where(Embedding.project_id == project_id)
                .where(series_filter)
                .where(Embedding.embedding.is_not(None))
                .order_by(cosine_distance(Embedding.embedding, query_vec))
                .limit(k * 4)
            )
        ).all()

        out: list[RetrievedItem] = []
        for emb, distance in rows:
            label_snip = await self._resolve_visible_label_snippet(
                db, emb.entity_type, emb.entity_id
            )
            if label_snip is None:
                # Hidden now (ai_visible=False) or deleted → skip defensively.
                continue
            label, snippet = label_snip
            out.append(
                RetrievedItem(
                    entity_type=emb.entity_type,
                    entity_id=emb.entity_id,
                    label=label,
                    snippet=snippet,
                    distance=float(distance) if distance is not None else 0.0,
                )
            )
            if len(out) >= k:
                break
        return out

    async def _resolve_visible_label_snippet(
        self, db: AsyncSession, entity_type: str, entity_id: uuid.UUID
    ) -> tuple[str, str] | None:
        """Look up an entity's display label + snippet, honouring ``ai_visible``.

        Returns ``None`` when the entity is gone or hidden (so retrieve drops it).
        """
        if entity_type == "codex":
            r = await db.get(CodexEntry, entity_id)
            if r is None or not r.ai_visible:
                return None
            return (r.title or "Kódex", _truncate(_join(r.title, r.role, r.content)))
        if entity_type == "character":
            r = await db.get(Character, entity_id)
            if r is None or not r.ai_visible:
                return None
            return (
                r.name or "Karakter",
                _truncate(_join(r.name, r.description, r.personality, r.backstory)),
            )
        if entity_type == "location":
            r = await db.get(Location, entity_id)
            if r is None or not r.ai_visible:
                return None
            return (
                r.name or "Helyszín",
                _truncate(_join(r.name, r.description, r.geography, r.atmosphere)),
            )
        if entity_type == "worldbuilding":
            r = await db.get(WorldbuildingEntry, entity_id)
            if r is None or not r.ai_visible:
                return None
            return (
                r.name or "Világépítés",
                _truncate(_join(r.name, r.category, r.description)),
            )
        if entity_type == "styleguide":
            r = await db.get(StyleGuide, entity_id)
            if r is None:
                return None
            return ("Stílusútmutató", _truncate(_join(r.tone, r.pov, r.tense, r.notes)))
        if entity_type == "scene":
            r = await db.get(Scene, entity_id)
            if r is None:
                return None
            return (
                r.title or "Jelenet",
                _truncate(_join(r.summary, r.content)),
            )
        if entity_type == "chapter":
            r = await db.get(Chapter, entity_id)
            if r is None:
                return None
            return (r.title or "Fejezet", _truncate(_join(r.title, r.summary)))
        # Unknown type: skip rather than guess.
        return None


embedding_service = EmbeddingService()
