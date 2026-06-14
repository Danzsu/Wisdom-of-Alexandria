import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scene import Scene
from app.schemas.scene import SceneCreate, SceneUpdate


async def create_scene(db: AsyncSession, chapter_id: uuid.UUID, data: SceneCreate) -> Scene:
    dump = data.model_dump()
    if dump.get("content"):
        dump["word_count"] = len(dump["content"].split())
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
        scene.word_count = len(scene.content.split()) if scene.content else 0
    await db.commit()
    await db.refresh(scene)
    return scene


async def delete_scene(db: AsyncSession, scene: Scene) -> None:
    await db.delete(scene)
    await db.commit()


async def reorder_scenes(db: AsyncSession, chapter_id: uuid.UUID, order: list[uuid.UUID]) -> list[Scene]:
    scenes = await list_scenes(db, chapter_id, include_archived=True)
    scene_map = {s.id: s for s in scenes}
    for idx, scene_id in enumerate(order):
        if scene_id in scene_map:
            scene_map[scene_id].order_index = idx
    await db.commit()
    return await list_scenes(db, chapter_id, include_archived=False)


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
