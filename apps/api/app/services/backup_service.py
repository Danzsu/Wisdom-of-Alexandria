"""Project JSON backup/restore (Feature #5).

A backup is a self-contained, VERSIONED JSON envelope holding the user's
authored project graph. It can be restored into a BRAND-NEW project (a copy,
never a move) on the same or another instance.

Envelope shape (``version: 1``)::

    {
      "version": 1,
      "exported_at": "<iso8601 UTC>",
      "project": {...},
      "series": [...],
      "books": [...],
      "chapters": [...],
      "scenes": [...],
      "beats": [...],
      "codex_entries": [...],
      "characters": [...],
      "locations": [...],
      "worldbuilding_entries": [...],
      "snippets": [...],
      "style_guides": [...],
      "codex_relations": [...],
      "codex_progressions": [...]
    }

Each serialized entity keeps its ORIGINAL id and ORIGINAL foreign keys so the
restore can rebuild the graph with a fresh-id remap (old_id -> new_id).

INCLUDED (authored, durable content)
------------------------------------
* Project (title/description/language)
* Series, Books (book.series_id), Chapters, Scenes (content + summary +
  pov_character_id + location_id), Beats
* Codex: CodexEntry (codex_entry.series_id), Character, Location,
  WorldbuildingEntry, Snippet, StyleGuide
* CodexRelation (from/to entity ids), CodexProgression (entity/chapter/scene
  refs)
* Approved authored text: ``scene.content``, ``scene.summary``,
  ``chapter.summary``.

EXCLUDED (and WHY) — critical
-----------------------------
* ``Provider``    — holds ENCRYPTED API-KEY SECRETS. A backup is a portable,
                    shareable file; provider secrets must NEVER travel in it.
* ``Embedding``   — regenerable vector index (rebuilt from content on demand);
                    bloats the file and is environment/model specific.
* ``GenerationJob`` + ``Revision`` — transient AI history / job bookkeeping, not
                    authored content. (``Revision`` is the pre-overwrite scene
                    history; the approved current text already lives on the
                    Scene.) Restoring these would resurrect stale AI state.
* ``AIComment``   — transient AI annotations, same rationale as Revision.

Timestamps (``created_at`` / ``updated_at``) are intentionally NOT carried into
the restore: the restored rows are fresh and get server-default timestamps. The
``exported_at`` field documents when the backup was taken.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from alexandria_core.models.beat import Beat
from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.character import Character
from alexandria_core.models.codex_entry import CodexEntry
from alexandria_core.models.codex_progression import CodexProgression
from alexandria_core.models.codex_relation import CodexRelation
from alexandria_core.models.location import Location
from alexandria_core.models.project import Project
from alexandria_core.models.scene import Scene
from alexandria_core.models.series import Series
from alexandria_core.models.snippet import Snippet
from alexandria_core.models.style_guide import StyleGuide
from alexandria_core.models.worldbuilding_entry import WorldbuildingEntry
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

#: Current envelope schema version. Bump (and branch in ``restore_project``)
#: when the shape changes incompatibly.
BACKUP_VERSION = 1

#: Defensive ceiling on how many entities a single restore payload may carry,
#: across ALL collections. Guards against an absurd/abusive upload before we
#: start instantiating ORM rows. A real novel project is well under this.
MAX_RESTORE_ENTITIES = 200_000

#: The top-level list keys in the envelope (everything except ``project`` and
#: the metadata fields). Used both to validate shape and to bound the size.
_COLLECTION_KEYS = (
    "series",
    "books",
    "chapters",
    "scenes",
    "beats",
    "codex_entries",
    "characters",
    "locations",
    "worldbuilding_entries",
    "snippets",
    "style_guides",
    "codex_relations",
    "codex_progressions",
)


class BackupError(ValueError):
    """Raised for a malformed or unsupported backup payload.

    The endpoint maps this to a clear 4xx (never a 500 traceback).
    """


def _uid(value: uuid.UUID | None) -> str | None:
    """Serialize a UUID (or None) to its string form (JSON-safe)."""
    return str(value) if value is not None else None


def _serialize_project(p: Project) -> dict[str, Any]:
    return {
        "id": _uid(p.id),
        "title": p.title,
        "description": p.description,
        "language": p.language,
    }


def _serialize_series(s: Series) -> dict[str, Any]:
    return {
        "id": _uid(s.id),
        "project_id": _uid(s.project_id),
        "title": s.title,
        "description": s.description,
        "order_index": s.order_index,
    }


def _serialize_book(b: Book) -> dict[str, Any]:
    return {
        "id": _uid(b.id),
        "project_id": _uid(b.project_id),
        "series_id": _uid(b.series_id),
        "title": b.title,
        "description": b.description,
        "synopsis": b.synopsis,
        "genre": b.genre,
        "language": b.language,
        "word_count_target": b.word_count_target,
        "order_index": b.order_index,
    }


def _serialize_chapter(c: Chapter) -> dict[str, Any]:
    return {
        "id": _uid(c.id),
        "book_id": _uid(c.book_id),
        "title": c.title,
        "summary": c.summary,
        "order_index": c.order_index,
        "status": c.status,
    }


def _serialize_scene(s: Scene) -> dict[str, Any]:
    return {
        "id": _uid(s.id),
        "chapter_id": _uid(s.chapter_id),
        "title": s.title,
        "content": s.content,
        "summary": s.summary,
        "order_index": s.order_index,
        "status": s.status,
        "word_count": s.word_count,
        "pov_character_id": _uid(s.pov_character_id),
        "location_id": _uid(s.location_id),
    }


def _serialize_beat(b: Beat) -> dict[str, Any]:
    return {
        "id": _uid(b.id),
        "scene_id": _uid(b.scene_id),
        "description": b.description,
        "beat_type": b.beat_type,
        "order_index": b.order_index,
        "notes": b.notes,
    }


def _serialize_codex_entry(e: CodexEntry) -> dict[str, Any]:
    return {
        "id": _uid(e.id),
        "project_id": _uid(e.project_id),
        "series_id": _uid(e.series_id),
        "title": e.title,
        "entry_type": e.entry_type,
        "content": e.content,
        "aliases": e.aliases,
        "role": e.role,
        "ai_visible": e.ai_visible,
        "tags": e.tags,
    }


def _serialize_character(c: Character) -> dict[str, Any]:
    return {
        "id": _uid(c.id),
        "project_id": _uid(c.project_id),
        "name": c.name,
        "aliases": c.aliases,
        "description": c.description,
        "backstory": c.backstory,
        "personality": c.personality,
        "appearance": c.appearance,
        "role": c.role,
        "ai_visible": c.ai_visible,
        "notes": c.notes,
    }


def _serialize_location(loc: Location) -> dict[str, Any]:
    return {
        "id": _uid(loc.id),
        "project_id": _uid(loc.project_id),
        "name": loc.name,
        "description": loc.description,
        "geography": loc.geography,
        "atmosphere": loc.atmosphere,
        "ai_visible": loc.ai_visible,
        "notes": loc.notes,
    }


def _serialize_worldbuilding(w: WorldbuildingEntry) -> dict[str, Any]:
    return {
        "id": _uid(w.id),
        "project_id": _uid(w.project_id),
        "name": w.name,
        "category": w.category,
        "description": w.description,
        "ai_visible": w.ai_visible,
        "notes": w.notes,
    }


def _serialize_snippet(s: Snippet) -> dict[str, Any]:
    return {
        "id": _uid(s.id),
        "project_id": _uid(s.project_id),
        "title": s.title,
        "content": s.content,
        # source_scene_id is an un-FK'd soft reference; remap it on restore if it
        # points at a scene in this backup, else drop it (see restore).
        "source_scene_id": _uid(s.source_scene_id),
        "tags": s.tags,
    }


def _serialize_style_guide(g: StyleGuide) -> dict[str, Any]:
    return {
        "id": _uid(g.id),
        "project_id": _uid(g.project_id),
        "tone": g.tone,
        "pov": g.pov,
        "tense": g.tense,
        "rules": g.rules,
        "examples": g.examples,
        "notes": g.notes,
    }


def _serialize_codex_relation(r: CodexRelation) -> dict[str, Any]:
    return {
        "id": _uid(r.id),
        "project_id": _uid(r.project_id),
        "from_entity_type": r.from_entity_type,
        "from_entity_id": _uid(r.from_entity_id),
        "to_entity_type": r.to_entity_type,
        "to_entity_id": _uid(r.to_entity_id),
        "relation_type": r.relation_type,
        "description": r.description,
    }


def _serialize_codex_progression(p: CodexProgression) -> dict[str, Any]:
    return {
        "id": _uid(p.id),
        "entity_type": p.entity_type,
        "entity_id": _uid(p.entity_id),
        "chapter_id": _uid(p.chapter_id),
        "scene_id": _uid(p.scene_id),
        "note": p.note,
    }


async def export_project(db: AsyncSession, project_id: uuid.UUID) -> dict[str, Any]:
    """Serialize a whole project graph to a versioned backup envelope.

    Returns ``None`` is never used; callers (the endpoint) check existence via
    the project lookup first and only call this for an existing, owned project.
    Raises ``BackupError`` if the project does not exist (defensive — the
    endpoint already 404s, but the service must not silently return a half
    envelope).

    Excludes Provider/Embedding/GenerationJob/Revision/AIComment (see module
    docstring).
    """
    project = (
        await db.execute(select(Project).where(Project.id == project_id))
    ).scalar_one_or_none()
    if project is None:
        raise BackupError("Project not found")

    async def _all(model, *where):  # type: ignore[no-untyped-def]
        result = await db.execute(select(model).where(*where))
        return list(result.scalars().all())

    series = await _all(Series, Series.project_id == project_id)
    books = await _all(Book, Book.project_id == project_id)
    book_ids = [b.id for b in books]
    chapters = (
        await _all(Chapter, Chapter.book_id.in_(book_ids)) if book_ids else []
    )
    chapter_ids = [c.id for c in chapters]
    scenes = (
        await _all(Scene, Scene.chapter_id.in_(chapter_ids)) if chapter_ids else []
    )
    scene_ids = [s.id for s in scenes]
    beats = await _all(Beat, Beat.scene_id.in_(scene_ids)) if scene_ids else []

    codex_entries = await _all(CodexEntry, CodexEntry.project_id == project_id)
    characters = await _all(Character, Character.project_id == project_id)
    locations = await _all(Location, Location.project_id == project_id)
    worldbuilding = await _all(
        WorldbuildingEntry, WorldbuildingEntry.project_id == project_id
    )
    snippets = await _all(Snippet, Snippet.project_id == project_id)
    style_guides = await _all(StyleGuide, StyleGuide.project_id == project_id)
    relations = await _all(CodexRelation, CodexRelation.project_id == project_id)

    # CodexProgression has no project_id column; it references chapters/scenes
    # (and a polymorphic entity). Scope it to this project's chapters OR scenes.
    progressions: list[CodexProgression] = []
    if chapter_ids or scene_ids:
        prog_result = await db.execute(
            select(CodexProgression).where(
                (CodexProgression.chapter_id.in_(chapter_ids))
                | (CodexProgression.scene_id.in_(scene_ids))
            )
        )
        progressions = list(prog_result.scalars().all())

    return {
        "version": BACKUP_VERSION,
        "exported_at": datetime.now(UTC).isoformat(),
        "project": _serialize_project(project),
        "series": [_serialize_series(s) for s in series],
        "books": [_serialize_book(b) for b in books],
        "chapters": [_serialize_chapter(c) for c in chapters],
        "scenes": [_serialize_scene(s) for s in scenes],
        "beats": [_serialize_beat(b) for b in beats],
        "codex_entries": [_serialize_codex_entry(e) for e in codex_entries],
        "characters": [_serialize_character(c) for c in characters],
        "locations": [_serialize_location(loc) for loc in locations],
        "worldbuilding_entries": [
            _serialize_worldbuilding(w) for w in worldbuilding
        ],
        "snippets": [_serialize_snippet(s) for s in snippets],
        "style_guides": [_serialize_style_guide(g) for g in style_guides],
        "codex_relations": [_serialize_codex_relation(r) for r in relations],
        "codex_progressions": [
            _serialize_codex_progression(p) for p in progressions
        ],
    }


def _require(payload: Any) -> dict[str, Any]:
    """Validate the payload is a dict with the version + the expected keys."""
    if not isinstance(payload, dict):
        raise BackupError("Backup payload must be a JSON object.")

    version = payload.get("version")
    if version is None:
        raise BackupError("Backup payload is missing the 'version' field.")
    if version != BACKUP_VERSION:
        raise BackupError(
            f"Unsupported backup version: {version!r} "
            f"(this server supports version {BACKUP_VERSION})."
        )

    project = payload.get("project")
    if not isinstance(project, dict):
        raise BackupError("Backup payload is missing the 'project' object.")
    if not project.get("title"):
        raise BackupError("Backup project is missing a title.")

    total = 0
    for key in _COLLECTION_KEYS:
        value = payload.get(key, [])
        if not isinstance(value, list):
            raise BackupError(f"Backup field '{key}' must be a list.")
        total += len(value)
    if total > MAX_RESTORE_ENTITIES:
        raise BackupError(
            f"Backup is too large to restore ({total} entities; "
            f"limit {MAX_RESTORE_ENTITIES})."
        )
    return payload


def _parse_uid(value: Any) -> uuid.UUID | None:
    """Parse an id from the payload (str/UUID/None) → UUID or None.

    A present-but-malformed id raises (we never silently drop a broken FK)."""
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return value
    try:
        return uuid.UUID(str(value))
    except (ValueError, AttributeError, TypeError) as exc:
        raise BackupError(f"Malformed id in backup: {value!r}") from exc


def _remap(old: Any, id_map: dict[uuid.UUID, uuid.UUID]) -> uuid.UUID | None:
    """Map an OLD id to its freshly-created NEW id (None passes through).

    A non-null id that is NOT in the map means a dangling reference in the
    backup; we drop it to None rather than persist a dangling FK."""
    parsed = _parse_uid(old)
    if parsed is None:
        return None
    return id_map.get(parsed)


async def restore_project(db: AsyncSession, payload: Any) -> Project:
    """Restore a backup envelope into a BRAND-NEW project (fresh ids).

    Rebuilds the whole graph in DEPENDENCY ORDER, remapping every FK via an
    ``old_id -> new_id`` map:

      project → series → books(series_id) → chapters → characters + locations
      → scenes(pov_character_id, location_id) → beats ;
      worldbuilding/codex_entries(series_id)/snippets(source_scene_id)/
      style_guides ; then codex_relations (from/to ids) + codex_progressions
      (entity/chapter/scene ids) which reference the already-remapped ids.

    TRANSACTIONAL: any failure rolls back the session so NO partial project is
    left behind. Raises ``BackupError`` for a malformed/unsupported payload
    (mapped to a 4xx by the endpoint).
    """
    data = _require(payload)

    # One id-map per logical id-space. Characters live in their own space (only
    # scene.pov_character_id points at them); codex relations/progressions
    # reference ids across spaces, so we keep a single merged "entity" map for
    # them in addition to the typed maps.
    series_map: dict[uuid.UUID, uuid.UUID] = {}
    book_map: dict[uuid.UUID, uuid.UUID] = {}
    chapter_map: dict[uuid.UUID, uuid.UUID] = {}
    scene_map: dict[uuid.UUID, uuid.UUID] = {}
    character_map: dict[uuid.UUID, uuid.UUID] = {}
    location_map: dict[uuid.UUID, uuid.UUID] = {}
    worldbuilding_map: dict[uuid.UUID, uuid.UUID] = {}
    codex_map: dict[uuid.UUID, uuid.UUID] = {}

    try:
        # 1. Project (root, fresh id).
        src = data["project"]
        project = Project(
            title=src["title"],
            description=src.get("description"),
            language=src.get("language") or "hu",
        )
        db.add(project)
        await db.flush()  # assigns project.id

        # 2. Series (project-scoped).
        for s in data.get("series", []):
            row = Series(
                project_id=project.id,
                title=s["title"],
                description=s.get("description"),
                order_index=s.get("order_index", 0),
            )
            db.add(row)
            await db.flush()
            series_map[_parse_uid(s["id"])] = row.id

        # 3. Books (series_id remapped).
        for b in data.get("books", []):
            row = Book(
                project_id=project.id,
                series_id=_remap(b.get("series_id"), series_map),
                title=b["title"],
                description=b.get("description"),
                synopsis=b.get("synopsis"),
                genre=b.get("genre"),
                language=b.get("language") or "hu",
                word_count_target=b.get("word_count_target"),
                order_index=b.get("order_index", 0),
            )
            db.add(row)
            await db.flush()
            book_map[_parse_uid(b["id"])] = row.id

        # 4. Chapters (book_id remapped). A chapter whose book is missing is a
        #    broken backup — skip it rather than orphan it.
        for c in data.get("chapters", []):
            new_book_id = _remap(c.get("book_id"), book_map)
            if new_book_id is None:
                continue
            row = Chapter(
                book_id=new_book_id,
                title=c["title"],
                summary=c.get("summary"),
                order_index=c.get("order_index", 0),
                status=c.get("status") or "draft",
            )
            db.add(row)
            await db.flush()
            chapter_map[_parse_uid(c["id"])] = row.id

        # 5. Characters (project-scoped) — created BEFORE scenes so a scene's
        #    pov_character_id can be remapped.
        for ch in data.get("characters", []):
            row = Character(
                project_id=project.id,
                name=ch["name"],
                aliases=ch.get("aliases"),
                description=ch.get("description"),
                backstory=ch.get("backstory"),
                personality=ch.get("personality"),
                appearance=ch.get("appearance"),
                role=ch.get("role"),
                ai_visible=ch.get("ai_visible", True),
                notes=ch.get("notes"),
            )
            db.add(row)
            await db.flush()
            character_map[_parse_uid(ch["id"])] = row.id

        # 6. Locations (project-scoped) — created BEFORE scenes so a scene's
        #    location_id can be remapped (same rationale as characters above).
        for loc in data.get("locations", []):
            row = Location(
                project_id=project.id,
                name=loc["name"],
                description=loc.get("description"),
                geography=loc.get("geography"),
                atmosphere=loc.get("atmosphere"),
                ai_visible=loc.get("ai_visible", True),
                notes=loc.get("notes"),
            )
            db.add(row)
            await db.flush()
            location_map[_parse_uid(loc["id"])] = row.id

        # 7. Scenes (chapter_id + pov_character_id + location_id remapped).
        for sc in data.get("scenes", []):
            new_chapter_id = _remap(sc.get("chapter_id"), chapter_map)
            if new_chapter_id is None:
                continue
            row = Scene(
                chapter_id=new_chapter_id,
                title=sc["title"],
                content=sc.get("content"),
                summary=sc.get("summary"),
                order_index=sc.get("order_index", 0),
                status=sc.get("status") or "draft",
                word_count=sc.get("word_count", 0),
                pov_character_id=_remap(
                    sc.get("pov_character_id"), character_map
                ),
                location_id=_remap(sc.get("location_id"), location_map),
            )
            db.add(row)
            await db.flush()
            scene_map[_parse_uid(sc["id"])] = row.id

        # 8. Beats (scene_id remapped).
        for bt in data.get("beats", []):
            new_scene_id = _remap(bt.get("scene_id"), scene_map)
            if new_scene_id is None:
                continue
            db.add(
                Beat(
                    scene_id=new_scene_id,
                    description=bt["description"],
                    beat_type=bt.get("beat_type"),
                    order_index=bt.get("order_index", 0),
                    notes=bt.get("notes"),
                )
            )

        # 9. Worldbuilding entries (project-scoped).
        for w in data.get("worldbuilding_entries", []):
            row = WorldbuildingEntry(
                project_id=project.id,
                name=w["name"],
                category=w.get("category"),
                description=w.get("description"),
                ai_visible=w.get("ai_visible", True),
                notes=w.get("notes"),
            )
            db.add(row)
            await db.flush()
            worldbuilding_map[_parse_uid(w["id"])] = row.id

        # 10. Codex entries (project-scoped, series_id remapped).
        for e in data.get("codex_entries", []):
            row = CodexEntry(
                project_id=project.id,
                series_id=_remap(e.get("series_id"), series_map),
                title=e["title"],
                entry_type=e.get("entry_type") or "custom",
                content=e.get("content"),
                aliases=e.get("aliases"),
                role=e.get("role"),
                ai_visible=e.get("ai_visible", True),
                tags=e.get("tags"),
            )
            db.add(row)
            await db.flush()
            codex_map[_parse_uid(e["id"])] = row.id

        # 11. Snippets (project-scoped; source_scene_id is a soft ref — remap if
        #     it points at a restored scene, else drop to None).
        for sn in data.get("snippets", []):
            db.add(
                Snippet(
                    project_id=project.id,
                    title=sn["title"],
                    content=sn["content"],
                    source_scene_id=_remap(
                        sn.get("source_scene_id"), scene_map
                    ),
                    tags=sn.get("tags"),
                )
            )

        # 12. Style guides (project-scoped; the model enforces one per project).
        for g in data.get("style_guides", []):
            db.add(
                StyleGuide(
                    project_id=project.id,
                    tone=g.get("tone"),
                    pov=g.get("pov"),
                    tense=g.get("tense"),
                    rules=g.get("rules"),
                    examples=g.get("examples"),
                    notes=g.get("notes"),
                )
            )

        # 13. Codex relations — from/to ids point at any codex-space entity
        #     (character/location/worldbuilding/codex_entry). Remap against the
        #     matching typed map by entity_type; a relation with an
        #     unresolvable endpoint is dropped (broken backup) rather than
        #     persisted dangling.
        for r in data.get("codex_relations", []):
            new_from = _remap_entity(
                r.get("from_entity_type"),
                r.get("from_entity_id"),
                character_map,
                location_map,
                worldbuilding_map,
                codex_map,
            )
            new_to = _remap_entity(
                r.get("to_entity_type"),
                r.get("to_entity_id"),
                character_map,
                location_map,
                worldbuilding_map,
                codex_map,
            )
            if new_from is None or new_to is None:
                continue
            db.add(
                CodexRelation(
                    project_id=project.id,
                    from_entity_type=r["from_entity_type"],
                    from_entity_id=new_from,
                    to_entity_type=r["to_entity_type"],
                    to_entity_id=new_to,
                    relation_type=r["relation_type"],
                    description=r.get("description"),
                )
            )

        # 14. Codex progressions — entity_id is polymorphic (remap by
        #     entity_type); chapter_id/scene_id remapped against their maps.
        for p in data.get("codex_progressions", []):
            new_entity = _remap_entity(
                p.get("entity_type"),
                p.get("entity_id"),
                character_map,
                location_map,
                worldbuilding_map,
                codex_map,
            )
            if new_entity is None:
                continue
            db.add(
                CodexProgression(
                    entity_type=p["entity_type"],
                    entity_id=new_entity,
                    chapter_id=_remap(p.get("chapter_id"), chapter_map),
                    scene_id=_remap(p.get("scene_id"), scene_map),
                    note=p.get("note"),
                )
            )

        await db.commit()
    except BackupError:
        # A validation error mid-build (e.g. a missing required field) must not
        # leave a partial project behind.
        await db.rollback()
        raise
    except Exception:
        # Any DB/integrity/other failure: roll back so no orphan project.
        await db.rollback()
        raise

    await db.refresh(project)
    return project


def _remap_entity(
    entity_type: Any,
    entity_id: Any,
    character_map: dict[uuid.UUID, uuid.UUID],
    location_map: dict[uuid.UUID, uuid.UUID],
    worldbuilding_map: dict[uuid.UUID, uuid.UUID],
    codex_map: dict[uuid.UUID, uuid.UUID],
) -> uuid.UUID | None:
    """Remap a polymorphic codex-entity id by its ``entity_type``.

    Returns the new id, or None when the type is unknown / the id is not in the
    matching map (a dangling reference — the caller drops the row)."""
    mapping = {
        "character": character_map,
        "location": location_map,
        "worldbuilding": worldbuilding_map,
        "worldbuilding_entry": worldbuilding_map,
        "codex": codex_map,
        "codex_entry": codex_map,
    }.get(str(entity_type or "").lower())
    if mapping is None:
        return None
    return _remap(entity_id, mapping)
