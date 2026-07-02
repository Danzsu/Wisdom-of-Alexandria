"""Demo seed (`python -m app.seed`) — idempotence + content contract.

Runs against the shared SQLite (or CI Postgres) test engine via the
``db_session`` fixture. The seed must fully populate an empty DB on the first
run and strictly no-op on any later run (its guard: any existing project).
"""

import pytest
from alexandria_core.models import (
    Beat,
    Book,
    Chapter,
    Character,
    Location,
    Project,
    Scene,
    WorldbuildingEntry,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.seed import DEMO_PROJECT_TITLE, seed_demo


async def _count(session: AsyncSession, model) -> int:
    return (await session.scalar(select(func.count()).select_from(model))) or 0


async def _snapshot(session: AsyncSession) -> dict[str, int]:
    return {
        "projects": await _count(session, Project),
        "books": await _count(session, Book),
        "chapters": await _count(session, Chapter),
        "scenes": await _count(session, Scene),
        "beats": await _count(session, Beat),
        "characters": await _count(session, Character),
        "locations": await _count(session, Location),
        "worldbuilding": await _count(session, WorldbuildingEntry),
    }


@pytest.mark.asyncio
async def test_seed_populates_empty_db_once_and_second_run_noops(
    db_session: AsyncSession,
) -> None:
    assert await _count(db_session, Project) == 0, "test expects an empty DB"

    # First run: seeds.
    assert await seed_demo(db_session) is True

    first = await _snapshot(db_session)
    assert first == {
        "projects": 1,
        "books": 1,
        "chapters": 2,
        "scenes": 3,
        "beats": 7,
        "characters": 1,
        "locations": 1,
        "worldbuilding": 1,
    }

    # Content contract: the demo project is recognizable + Hungarian.
    project = (await db_session.scalars(select(Project))).one()
    assert project.title == DEMO_PROJECT_TITLE
    assert project.language == "hu"

    # Every scene ships with beats and non-empty content (the demo must be
    # browsable in the plan board AND the editor, not a shell of titles).
    scenes = (await db_session.scalars(select(Scene))).all()
    for scene in scenes:
        assert scene.content, f"scene {scene.title!r} has empty content"
    beat_scene_ids = set((await db_session.scalars(select(Beat.scene_id))).all())
    assert beat_scene_ids == {s.id for s in scenes}, "every scene must have beats"

    # The character has aliases (feeds manuscript name detection).
    character = (await db_session.scalars(select(Character))).one()
    assert character.aliases, "demo character must have aliases"

    # Second run: strict no-op.
    assert await seed_demo(db_session) is False
    assert await _snapshot(db_session) == first


@pytest.mark.asyncio
async def test_seed_refuses_when_any_project_exists(db_session: AsyncSession) -> None:
    """A real (non-demo) workspace must never be touched by the seed."""
    db_session.add(Project(title="Saját regényem", language="hu"))
    await db_session.commit()

    assert await seed_demo(db_session) is False
    assert await _count(db_session, Project) == 1
    assert await _count(db_session, Book) == 0
