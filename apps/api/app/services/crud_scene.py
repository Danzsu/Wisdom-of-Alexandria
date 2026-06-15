import uuid

from alexandria_core.models.scene import Scene
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.text import count_words
from app.schemas.scene import SceneCreate, SceneUpdate
from app.services.ordering import validate_permutation


async def create_scene(db: AsyncSession, chapter_id: uuid.UUID, data: SceneCreate) -> Scene:
    dump = data.model_dump()
    if dump.get("content"):
        dump["word_count"] = count_words(dump["content"])
    scene = Scene(chapter_id=chapter_id, **dump)
    db.add(scene)
    await db.commit()
    await db.refresh(scene)
    return scene


async def get_scene(db: AsyncSession, chapter_id: uuid.UUID, scene_id: uuid.UUID) -> Scene | None:
    result = await db.execute(
        select(Scene).where(Scene.id == scene_id, Scene.chapter_id == chapter_id)
    )
    return result.scalar_one_or_none()


async def list_scenes(db: AsyncSession, chapter_id: uuid.UUID, include_archived: bool = False) -> list[Scene]:
    query = select(Scene).where(Scene.chapter_id == chapter_id)
    if not include_archived:
        query = query.where(Scene.status != "archived")
    query = query.order_by(Scene.order_index, Scene.created_at)
    result = await db.execute(query)
    return list(result.scalars().all())


async def update_scene(db: AsyncSession, scene: Scene, data: SceneUpdate) -> Scene:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(scene, field, value)
    if "content" in data.model_dump(exclude_unset=True):
        scene.word_count = count_words(scene.content)
    await db.commit()
    await db.refresh(scene)
    return scene


async def delete_scene(db: AsyncSession, scene: Scene) -> None:
    await db.delete(scene)
    await db.commit()


async def reorder_scenes(db: AsyncSession, chapter_id: uuid.UUID, order: list[uuid.UUID]) -> list[Scene]:
    scenes = await list_scenes(db, chapter_id, include_archived=True)
    scene_map = {s.id: s for s in scenes}
    validate_permutation(order, set(scene_map), "scene")
    for idx, scene_id in enumerate(order):
        scene_map[scene_id].order_index = idx
    await db.commit()
    return await list_scenes(db, chapter_id, include_archived=False)


async def move_scene(
    db: AsyncSession,
    scene: Scene,
    target_chapter_id: uuid.UUID,
    target_index: int,
) -> Scene:
    """Move a scene to another chapter, inserting it at `target_index`.

    Renumbers `order_index` DENSELY (0..n-1, by current order) in BOTH the
    source chapter (closing the gap the scene leaves) and the target chapter
    (making room at the insertion slot). `target_index` is clamped to the
    target chapter's bounds, so an out-of-range index appends at the end rather
    than leaving a hole. A move to the SAME chapter is delegated to a positional
    reinsert within that chapter. `word_count` and `status` are untouched.

    Caller is responsible for validating that `target_chapter_id` belongs to the
    same book as the scene's current chapter (see the route handler).
    """
    source_chapter_id = scene.chapter_id

    if source_chapter_id == target_chapter_id:
        # Same-chapter reinsert: pull the scene out, reinsert at the clamped
        # slot, then densely renumber. (The board normally routes same-chapter
        # drags through reorder, but supporting it here keeps the endpoint
        # idempotent and avoids a special-case 400.)
        scenes = await list_scenes(db, source_chapter_id, include_archived=True)
        remaining = [s for s in scenes if s.id != scene.id]
        index = max(0, min(target_index, len(remaining)))
        remaining.insert(index, scene)
        for idx, item in enumerate(remaining):
            item.order_index = idx
        await db.commit()
        await db.refresh(scene)
        return scene

    # Cross-chapter move: detach from the source, then renumber both sides.
    source_scenes = await list_scenes(db, source_chapter_id, include_archived=True)
    target_scenes = await list_scenes(db, target_chapter_id, include_archived=True)

    # Source: drop the moving scene and close the gap densely.
    source_remaining = [s for s in source_scenes if s.id != scene.id]
    for idx, item in enumerate(source_remaining):
        item.order_index = idx

    # Move the scene to the target chapter and reinsert at the clamped slot.
    scene.chapter_id = target_chapter_id
    index = max(0, min(target_index, len(target_scenes)))
    target_scenes.insert(index, scene)
    for idx, item in enumerate(target_scenes):
        item.order_index = idx

    await db.commit()
    await db.refresh(scene)
    return scene


async def archive_scene(db: AsyncSession, scene: Scene) -> Scene:
    scene.status = "archived"
    await db.commit()
    await db.refresh(scene)
    return scene


async def unarchive_scene(db: AsyncSession, scene: Scene) -> Scene:
    scene.status = "draft"
    await db.commit()
    await db.refresh(scene)
    return scene
