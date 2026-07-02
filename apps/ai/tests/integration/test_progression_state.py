"""CodexProgression "state as of scene N" filtering (V1).

These tests pin the story-order linearization that selects each codex entity's
progression state as-of a TARGET scene S, for injection into the AI context.

Story-position of a progression is the reading position of its ``scene_id``
within the book: ``(chapter.order_index, scene.order_index)``. A chapter-level
progression (``scene_id`` NULL, ``chapter_id`` set) sorts at the START of that
chapter (before its scenes). A book-level progression (both NULL) sorts before
everything. Only progressions at-or-before S are included (never future ones),
and the "current state" is the LATEST at-or-before S per entity.

Real SQLite DB fixtures; the query is plain ordering by ``order_index`` (no
PostgreSQL-only SQL), so this stays on the default tier.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.character import Character
from alexandria_core.models.codex_progression import CodexProgression
from alexandria_core.models.project import Project
from alexandria_core.models.scene import Scene
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.progression_service import (
    ProgressionState,
    current_progressions_as_of_scene,
)


async def _make_book(db: AsyncSession) -> tuple[Project, Book]:
    project = Project(title="Progresszió projekt")
    db.add(project)
    await db.flush()
    book = Book(project_id=project.id, title="Könyv")
    db.add(book)
    await db.flush()
    return project, book


async def _add_chapter(db: AsyncSession, book: Book, order_index: int) -> Chapter:
    ch = Chapter(book_id=book.id, title=f"Fejezet {order_index}", order_index=order_index)
    db.add(ch)
    await db.flush()
    return ch


async def _add_scene(db: AsyncSession, chapter: Chapter, order_index: int) -> Scene:
    sc = Scene(
        chapter_id=chapter.id,
        title=f"Jelenet {order_index}",
        order_index=order_index,
        content="x",
    )
    db.add(sc)
    await db.flush()
    return sc


async def _add_character(db: AsyncSession, project: Project, *, ai_visible: bool = True) -> Character:
    ch = Character(project_id=project.id, name="Aragorn", ai_visible=ai_visible)
    db.add(ch)
    await db.flush()
    return ch


def _notes(states: list[ProgressionState]) -> dict[tuple[str, uuid.UUID], str | None]:
    return {(s.entity_type, s.entity_id): s.note for s in states}


@pytest.mark.integration
async def test_future_progression_excluded_past_included(db_session):
    """A progression dated AFTER S is excluded; one at/before S is included."""
    project, book = await _make_book(db_session)
    ch = await _add_chapter(db_session, book, 0)
    s1 = await _add_scene(db_session, ch, 0)
    s2 = await _add_scene(db_session, ch, 1)  # target S
    s3 = await _add_scene(db_session, ch, 2)  # future
    char = await _add_character(db_session, project)

    db_session.add_all(
        [
            CodexProgression(entity_type="character", entity_id=char.id, scene_id=s1.id, note="past"),
            CodexProgression(entity_type="character", entity_id=char.id, scene_id=s3.id, note="future"),
        ]
    )
    await db_session.commit()

    states = await current_progressions_as_of_scene(
        db_session, scene_id=s2.id, entities=[("character", char.id)]
    )
    assert _notes(states) == {("character", char.id): "past"}


@pytest.mark.integration
async def test_at_scene_is_included(db_session):
    """A progression AT S (scene_id == S) is at-or-before → included."""
    project, book = await _make_book(db_session)
    ch = await _add_chapter(db_session, book, 0)
    s1 = await _add_scene(db_session, ch, 0)
    char = await _add_character(db_session, project)
    db_session.add(
        CodexProgression(entity_type="character", entity_id=char.id, scene_id=s1.id, note="at-S")
    )
    await db_session.commit()

    states = await current_progressions_as_of_scene(
        db_session, scene_id=s1.id, entities=[("character", char.id)]
    )
    assert _notes(states) == {("character", char.id): "at-S"}


@pytest.mark.integration
async def test_ordering_across_chapters(db_session):
    """A progression in ch1/scene3 is BEFORE ch2/scene1 (global reading order)."""
    project, book = await _make_book(db_session)
    ch1 = await _add_chapter(db_session, book, 0)
    ch2 = await _add_chapter(db_session, book, 1)
    c1s3 = await _add_scene(db_session, ch1, 2)
    c2s1 = await _add_scene(db_session, ch2, 0)  # target S
    char = await _add_character(db_session, project)
    db_session.add(
        CodexProgression(entity_type="character", entity_id=char.id, scene_id=c1s3.id, note="ch1s3")
    )
    await db_session.commit()

    states = await current_progressions_as_of_scene(
        db_session, scene_id=c2s1.id, entities=[("character", char.id)]
    )
    # ch1/scene3 precedes ch2/scene1 → included.
    assert _notes(states) == {("character", char.id): "ch1s3"}


@pytest.mark.integration
async def test_later_chapter_progression_is_future(db_session):
    """A progression in ch2 is FUTURE relative to a target in ch1 → excluded."""
    project, book = await _make_book(db_session)
    ch1 = await _add_chapter(db_session, book, 0)
    ch2 = await _add_chapter(db_session, book, 1)
    c1s1 = await _add_scene(db_session, ch1, 0)  # target S
    c2s1 = await _add_scene(db_session, ch2, 0)
    char = await _add_character(db_session, project)
    db_session.add(
        CodexProgression(entity_type="character", entity_id=char.id, scene_id=c2s1.id, note="ch2s1")
    )
    await db_session.commit()

    states = await current_progressions_as_of_scene(
        db_session, scene_id=c1s1.id, entities=[("character", char.id)]
    )
    assert states == []


@pytest.mark.integration
async def test_chapter_level_progression_sorts_at_chapter_start(db_session):
    """A chapter-level progression (scene_id NULL) sorts BEFORE that chapter's
    scenes, but AFTER the prior chapter's scenes."""
    project, book = await _make_book(db_session)
    ch1 = await _add_chapter(db_session, book, 0)
    ch2 = await _add_chapter(db_session, book, 1)
    c1s1 = await _add_scene(db_session, ch1, 0)
    c2s1 = await _add_scene(db_session, ch2, 0)  # target S
    char = await _add_character(db_session, project)
    # Chapter-level progression on ch2 sorts at start of ch2 (before c2s1) → <= S.
    db_session.add(
        CodexProgression(entity_type="character", entity_id=char.id, chapter_id=ch2.id, note="ch2-start")
    )
    await db_session.commit()

    states = await current_progressions_as_of_scene(
        db_session, scene_id=c2s1.id, entities=[("character", char.id)]
    )
    assert _notes(states) == {("character", char.id): "ch2-start"}

    # But relative to a target in ch1, the ch2-start progression is FUTURE.
    states_ch1 = await current_progressions_as_of_scene(
        db_session, scene_id=c1s1.id, entities=[("character", char.id)]
    )
    assert states_ch1 == []


@pytest.mark.integration
async def test_chapter_level_sorts_before_same_chapter_scene_progression(db_session):
    """Within one chapter: a chapter-level progression precedes a scene-level
    one, so the LATEST at-or-before S is the scene-level note."""
    project, book = await _make_book(db_session)
    ch = await _add_chapter(db_session, book, 0)
    s0 = await _add_scene(db_session, ch, 0)  # target S
    char = await _add_character(db_session, project)
    db_session.add_all(
        [
            CodexProgression(entity_type="character", entity_id=char.id, chapter_id=ch.id, note="chapter-start"),
            CodexProgression(entity_type="character", entity_id=char.id, scene_id=s0.id, note="scene0"),
        ]
    )
    await db_session.commit()

    states = await current_progressions_as_of_scene(
        db_session, scene_id=s0.id, entities=[("character", char.id)]
    )
    # scene0 (order 0) sorts AFTER chapter-start → it is the latest at-or-before S.
    assert _notes(states) == {("character", char.id): "scene0"}


@pytest.mark.integration
async def test_book_level_progression_sorts_before_everything(db_session):
    """A book-level progression (both NULL) is always at-or-before S."""
    project, book = await _make_book(db_session)
    ch = await _add_chapter(db_session, book, 0)
    s0 = await _add_scene(db_session, ch, 0)  # target S
    char = await _add_character(db_session, project)
    db_session.add(
        CodexProgression(entity_type="character", entity_id=char.id, note="book-level")
    )
    await db_session.commit()

    states = await current_progressions_as_of_scene(
        db_session, scene_id=s0.id, entities=[("character", char.id)]
    )
    assert _notes(states) == {("character", char.id): "book-level"}


@pytest.mark.integration
async def test_latest_at_or_before_per_entity(db_session):
    """Multiple progressions for one entity → return the LATEST at-or-before S."""
    project, book = await _make_book(db_session)
    ch = await _add_chapter(db_session, book, 0)
    s0 = await _add_scene(db_session, ch, 0)
    s1 = await _add_scene(db_session, ch, 1)
    s2 = await _add_scene(db_session, ch, 2)  # target S
    s3 = await _add_scene(db_session, ch, 3)
    char = await _add_character(db_session, project)
    db_session.add_all(
        [
            CodexProgression(entity_type="character", entity_id=char.id, scene_id=s0.id, note="v0"),
            CodexProgression(entity_type="character", entity_id=char.id, scene_id=s1.id, note="v1"),
            CodexProgression(entity_type="character", entity_id=char.id, scene_id=s3.id, note="v3-future"),
        ]
    )
    await db_session.commit()

    states = await current_progressions_as_of_scene(
        db_session, scene_id=s2.id, entities=[("character", char.id)]
    )
    # v1 is the latest at-or-before S (s1 < s2 < s3); v0 superseded, v3 future.
    assert _notes(states) == {("character", char.id): "v1"}


@pytest.mark.integration
async def test_ai_invisible_entity_excluded(db_session):
    """A progression whose source entity is ai_visible=False is excluded."""
    project, book = await _make_book(db_session)
    ch = await _add_chapter(db_session, book, 0)
    s0 = await _add_scene(db_session, ch, 0)
    hidden = await _add_character(db_session, project, ai_visible=False)
    db_session.add(
        CodexProgression(entity_type="character", entity_id=hidden.id, scene_id=s0.id, note="secret")
    )
    await db_session.commit()

    states = await current_progressions_as_of_scene(
        db_session, scene_id=s0.id, entities=[("character", hidden.id)]
    )
    assert states == []


@pytest.mark.integration
async def test_multiple_entities_independent_selection(db_session):
    """Each entity gets its OWN latest-at-or-before-S note, independently."""
    project, book = await _make_book(db_session)
    ch = await _add_chapter(db_session, book, 0)
    s0 = await _add_scene(db_session, ch, 0)
    s1 = await _add_scene(db_session, ch, 1)  # target S
    a = await _add_character(db_session, project)
    b = Character(project_id=project.id, name="Boromir")
    db_session.add(b)
    await db_session.flush()
    db_session.add_all(
        [
            CodexProgression(entity_type="character", entity_id=a.id, scene_id=s0.id, note="a-s0"),
            CodexProgression(entity_type="character", entity_id=b.id, scene_id=s1.id, note="b-s1"),
        ]
    )
    await db_session.commit()

    states = await current_progressions_as_of_scene(
        db_session, scene_id=s1.id, entities=[("character", a.id), ("character", b.id)]
    )
    assert _notes(states) == {
        ("character", a.id): "a-s0",
        ("character", b.id): "b-s1",
    }


@pytest.mark.integration
async def test_no_progressions_returns_empty(db_session):
    project, book = await _make_book(db_session)
    ch = await _add_chapter(db_session, book, 0)
    s0 = await _add_scene(db_session, ch, 0)
    char = await _add_character(db_session, project)
    await db_session.commit()

    states = await current_progressions_as_of_scene(
        db_session, scene_id=s0.id, entities=[("character", char.id)]
    )
    assert states == []


@pytest.mark.integration
async def test_unresolvable_target_scene_returns_empty(db_session):
    """No/invalid target scene → empty (degrade, don't crash)."""
    project, book = await _make_book(db_session)
    char = await _add_character(db_session, project)
    states = await current_progressions_as_of_scene(
        db_session, scene_id=uuid.uuid4(), entities=[("character", char.id)]
    )
    assert states == []
    states_none = await current_progressions_as_of_scene(
        db_session, scene_id=None, entities=[("character", char.id)]
    )
    assert states_none == []


@pytest.mark.integration
async def test_cross_book_scoping(db_session):
    """Two books in the SAME project pin the anchorless-vs-anchored semantics:

    (a) an anchorless (book-level) progression is a PROJECT-GLOBAL baseline —
        visible to a target scene in EITHER book, and
    (b) a SCENE-anchored progression in book A is NOT visible to a target scene
        in book B (book scoping holds for anchored progressions).
    """
    project = Project(title="Két könyv projekt")
    db_session.add(project)
    await db_session.flush()
    book_a = Book(project_id=project.id, title="A könyv")
    book_b = Book(project_id=project.id, title="B könyv")
    db_session.add_all([book_a, book_b])
    await db_session.flush()
    ch_a = await _add_chapter(db_session, book_a, 0)
    ch_b = await _add_chapter(db_session, book_b, 0)
    a_s0 = await _add_scene(db_session, ch_a, 0)
    b_s0 = await _add_scene(db_session, ch_b, 0)
    char = Character(project_id=project.id, name="Aragorn")
    db_session.add(char)
    await db_session.flush()

    db_session.add_all(
        [
            # Anchorless = project-global baseline (no scene/chapter anchor).
            CodexProgression(entity_type="character", entity_id=char.id, note="global-baseline"),
            # Scene-anchored in book A only.
            CodexProgression(entity_type="character", entity_id=char.id, scene_id=a_s0.id, note="book-a-only"),
        ]
    )
    await db_session.commit()

    # Target in book A: the book-A scene progression is the LATEST at-or-before S
    # (it sorts after the anchorless baseline), so it wins.
    states_a = await current_progressions_as_of_scene(
        db_session, scene_id=a_s0.id, entities=[("character", char.id)]
    )
    assert _notes(states_a) == {("character", char.id): "book-a-only"}

    # Target in book B: the book-A scene progression is NOT in book B's scope, so
    # only the project-global baseline applies.
    states_b = await current_progressions_as_of_scene(
        db_session, scene_id=b_s0.id, entities=[("character", char.id)]
    )
    assert _notes(states_b) == {("character", char.id): "global-baseline"}


@pytest.mark.integration
async def test_same_position_tiebreak_later_created_wins(db_session):
    """Two progressions for the same entity at the SAME story position → the
    LATER-created note wins (deterministic, not DB iteration order)."""
    project, book = await _make_book(db_session)
    ch = await _add_chapter(db_session, book, 0)
    s0 = await _add_scene(db_session, ch, 0)  # target S
    char = await _add_character(db_session, project)

    base = datetime(2026, 1, 1, tzinfo=UTC)
    # Insert the EARLIER one second in row order to prove ordering is by
    # created_at, not insertion / PK order.
    later = CodexProgression(
        entity_type="character", entity_id=char.id, scene_id=s0.id, note="later",
        created_at=base + timedelta(hours=1),
    )
    earlier = CodexProgression(
        entity_type="character", entity_id=char.id, scene_id=s0.id, note="earlier",
        created_at=base,
    )
    db_session.add_all([later, earlier])
    await db_session.commit()

    states = await current_progressions_as_of_scene(
        db_session, scene_id=s0.id, entities=[("character", char.id)]
    )
    assert _notes(states) == {("character", char.id): "later"}
