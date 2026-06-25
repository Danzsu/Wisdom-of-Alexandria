"""CodexProgression "state as of scene N" linearization (V1).

The MVP shipped :class:`CodexProgression` as CRUD-only ("AI does not filter
yet"). This module makes the AI context include each codex entity's progression
state **as of** a target scene S, in correct story order.

Approach — **join-based linearization, NO migration / NO order column**:

A progression's story-position is the reading position of its ``scene_id``
within the book, i.e. ``(chapter.order_index, scene.order_index)``. We compute
that position by JOINING progressions → scenes/chapters at query time, rather
than denormalizing a linear order onto the row. This is correct-by-construction
and cannot drift when scenes/chapters are reordered (a denormalized order column
would have to be recomputed on every move, and silently rots if a move path
forgets to). The progression table is small (one row per recorded state change),
so the join is cheap; ordering is plain integer ``order_index`` comparison (no
PostgreSQL-only SQL), so this stays on the default SQLite test tier.

Sort key per progression, with a chapter/scene "phase" tiebreak:

- **book-level / anchorless** (``chapter_id`` NULL, ``scene_id`` NULL) →
  ``(-1, -1)``: a PROJECT-GLOBAL BASELINE for the entity. Codex entities are
  project-scoped (shared across books) and an anchorless progression has no book
  anchor, so it applies to every scene in every book of the project, sorting
  before everything in whichever book the target scene is in. (Anchored
  progressions stay book + story-position scoped.)
- **chapter-level** (``chapter_id`` set, ``scene_id`` NULL) →
  ``(chapter.order_index, -1, 0)``: sorts at the START of that chapter, before
  its scenes (phase ``-1`` < any scene's phase ``0``).
- **scene-level** (``scene_id`` set) →
  ``(chapter.order_index, scene.order_index, 0)``.

Only progressions whose position is ``<=`` S's position are included (never
future ones — they would be spoilers / the wrong state). The "current state as
of S" is the LATEST at-or-before S per entity.

``ai_visible`` is respected: a progression whose source codex entity is hidden
from the AI is excluded, consistent with how RAG retrieval re-checks visibility.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from alexandria_core.models.chapter import Chapter
from alexandria_core.models.character import Character
from alexandria_core.models.codex_entry import CodexEntry
from alexandria_core.models.codex_progression import CodexProgression
from alexandria_core.models.location import Location
from alexandria_core.models.scene import Scene
from alexandria_core.models.worldbuilding_entry import WorldbuildingEntry
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

# Sentinel "phase" placing chapter-level / book-level progressions before scenes.
_BEFORE_SCENES = -1

# entity_type → (model class, ai_visible-bearing). Only these codex-family types
# carry an ``ai_visible`` flag; an unknown type is treated as visible (the
# progression's entity is opaque to us, so we don't hide it spuriously).
_AI_VISIBLE_MODELS = {
    "character": Character,
    "codex": CodexEntry,
    "location": Location,
    "worldbuilding": WorldbuildingEntry,
}


@dataclass(frozen=True)
class ProgressionState:
    """An entity's progression note that is current as of the target scene."""

    entity_type: str
    entity_id: uuid.UUID
    note: str | None


@dataclass(frozen=True)
class _Positioned:
    entity_type: str
    entity_id: uuid.UUID
    note: str | None
    # Story-position sort key is ``(chapter_order, scene_phase)``. Two
    # progressions can share a position (e.g. two notes anchored to the same
    # scene). ``created_at`` (then ``progression_id`` as a final, total-order
    # fallback) breaks that tie deterministically so "latest" never depends on
    # nondeterministic DB row iteration order.
    chapter_order: int
    scene_phase: int
    created_at: datetime
    progression_id: uuid.UUID


async def _scene_position(
    db: AsyncSession, scene_id: uuid.UUID
) -> tuple[uuid.UUID, int, int] | None:
    """Resolve target scene S → ``(book_id, chapter.order_index, scene.order_index)``.

    Returns ``None`` when the scene (or its chapter) cannot be resolved — the
    caller then degrades to an empty result.
    """
    row = (
        await db.execute(
            select(Chapter.book_id, Chapter.order_index, Scene.order_index)
            .select_from(Scene)
            .join(Chapter, Scene.chapter_id == Chapter.id)
            .where(Scene.id == scene_id)
        )
    ).one_or_none()
    if row is None:
        return None
    return row[0], row[1], row[2]


async def current_progressions_as_of_scene(
    db: AsyncSession,
    *,
    scene_id: uuid.UUID | None,
    entities: list[tuple[str, uuid.UUID]],
) -> list[ProgressionState]:
    """Return each entity's progression note that is CURRENT as of scene ``S``.

    For each ``(entity_type, entity_id)`` in ``entities``, returns the LATEST
    progression whose story-position is at-or-before ``S``'s position within
    ``S``'s book (see module docstring for the ordering rules). Entities with no
    qualifying progression are omitted (not returned with a ``None`` note).

    Degrades to ``[]`` when ``scene_id`` is missing/unresolvable or ``entities``
    is empty. ``ai_visible=False`` source entities are excluded.
    """
    if scene_id is None or not entities:
        return []
    pos = await _scene_position(db, scene_id)
    if pos is None:
        return []
    book_id, target_chapter_order, target_scene_order = pos
    target_key = (target_chapter_order, target_scene_order)

    entity_keys = set(entities)
    entity_types = {et for et, _ in entities}
    entity_ids = {eid for _, eid in entities}

    # Load candidate progressions for the requested entities. Resolve each
    # progression's owning chapter (via its scene_id OR its chapter_id) and the
    # scene's order_index, restricted to THIS book so a progression attached to a
    # scene in another book never bleeds in. Book-level progressions (both NULL)
    # have no chapter/scene join, so they are fetched in a second pass below.
    scene_prog = (
        await db.execute(
            select(
                CodexProgression,
                Chapter.book_id,
                Chapter.order_index,
                Scene.order_index,
            )
            .join(Scene, CodexProgression.scene_id == Scene.id)
            .join(Chapter, Scene.chapter_id == Chapter.id)
            .where(
                CodexProgression.entity_type.in_(entity_types),
                CodexProgression.entity_id.in_(entity_ids),
                CodexProgression.scene_id.is_not(None),
            )
        )
    ).all()

    chapter_prog = (
        await db.execute(
            select(CodexProgression, Chapter.book_id, Chapter.order_index)
            .join(Chapter, CodexProgression.chapter_id == Chapter.id)
            .where(
                CodexProgression.entity_type.in_(entity_types),
                CodexProgression.entity_id.in_(entity_ids),
                CodexProgression.scene_id.is_(None),
                CodexProgression.chapter_id.is_not(None),
            )
        )
    ).all()

    book_prog = (
        await db.execute(
            select(CodexProgression).where(
                CodexProgression.entity_type.in_(entity_types),
                CodexProgression.entity_id.in_(entity_ids),
                CodexProgression.scene_id.is_(None),
                CodexProgression.chapter_id.is_(None),
            )
        )
    ).scalars().all()

    positioned: list[_Positioned] = []

    def _consider(prog: CodexProgression, chapter_order: int, scene_phase: int) -> None:
        key = (prog.entity_type, prog.entity_id)
        if key not in entity_keys:
            return
        positioned.append(
            _Positioned(
                entity_type=prog.entity_type,
                entity_id=prog.entity_id,
                note=prog.note,
                chapter_order=chapter_order,
                scene_phase=scene_phase,
                created_at=prog.created_at,
                progression_id=prog.id,
            )
        )

    for prog, prog_book_id, chapter_order, scene_order in scene_prog:
        if prog_book_id != book_id:
            continue  # scene lives in another book of the project
        _consider(prog, chapter_order, scene_order)

    for prog, prog_book_id, chapter_order in chapter_prog:
        if prog_book_id != book_id:
            continue
        # Chapter-level sorts at the START of its chapter (before any scene).
        _consider(prog, chapter_order, _BEFORE_SCENES)

    for prog in book_prog:
        # ANCHORLESS = PROJECT-GLOBAL BASELINE (intentional, NO book_id column).
        #
        # Codex entities are PROJECT-scoped (shared across every book of the
        # project), and an anchorless progression (scene_id AND chapter_id both
        # NULL) has no book/story anchor. So its correct semantics is a
        # project-global baseline for that entity: it applies to EVERY scene in
        # EVERY book of the project, sorting before everything in whichever book
        # the target scene lives in. (Scene/chapter-anchored progressions stay
        # book + story-position scoped — already enforced by the prog_book_id
        # filters above.) This is why ``book_prog`` is deliberately NOT filtered
        # by ``book_id`` — there is no book to filter on, and filtering it out
        # would drop the baseline entirely. The cross-book test pins both halves.
        _consider(prog, _BEFORE_SCENES, _BEFORE_SCENES)

    # Keep only progressions at-or-before S, then pick the LATEST per entity.
    visible_ids = await _visible_entity_ids(db, entities)

    def _rank(p: _Positioned) -> tuple[int, int, datetime, uuid.UUID]:
        # Total order: story-position first, then created_at, then id as a final
        # deterministic fallback (so equal-position, equal-timestamp duplicates
        # still resolve the same way every run — never by DB iteration order).
        return (p.chapter_order, p.scene_phase, p.created_at, p.progression_id)

    best: dict[tuple[str, uuid.UUID], _Positioned] = {}
    for p in positioned:
        key = (p.entity_type, p.entity_id)
        if key not in visible_ids:
            continue  # source entity hidden from AI
        if (p.chapter_order, p.scene_phase) > target_key:
            continue  # future progression — exclude
        cur = best.get(key)
        # A candidate wins iff it ranks strictly higher (later story-position, or
        # same position but later created_at, or a higher id as the final tie).
        if cur is None or _rank(p) > _rank(cur):
            best[key] = p

    # Preserve the caller's entity order for deterministic context rendering.
    out: list[ProgressionState] = []
    for et, eid in entities:
        p = best.get((et, eid))
        if p is not None:
            out.append(ProgressionState(entity_type=et, entity_id=eid, note=p.note))
    return out


async def _visible_entity_ids(
    db: AsyncSession, entities: list[tuple[str, uuid.UUID]]
) -> set[tuple[str, uuid.UUID]]:
    """Return the subset of ``entities`` whose source row is ``ai_visible``.

    Types without an ``ai_visible`` flag (or unknown types) are kept as-is — we
    don't fabricate a visibility gate where the model has none. An entity whose
    row is missing is dropped (it can't contribute a visible state).
    """
    visible: set[tuple[str, uuid.UUID]] = set()
    by_type: dict[str, set[uuid.UUID]] = {}
    for et, eid in entities:
        by_type.setdefault(et, set()).add(eid)

    for et, ids in by_type.items():
        model = _AI_VISIBLE_MODELS.get(et)
        if model is None:
            # No ai_visible column for this type → keep all (e.g. styleguide).
            for eid in ids:
                visible.add((et, eid))
            continue
        rows = (
            await db.execute(
                select(model.id, model.ai_visible).where(model.id.in_(ids))
            )
        ).all()
        for row_id, ai_visible in rows:
            if ai_visible:
                visible.add((et, row_id))
    return visible
