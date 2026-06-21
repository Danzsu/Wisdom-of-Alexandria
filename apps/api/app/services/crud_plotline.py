import uuid

from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.plotline import Plotline
from alexandria_core.models.plotline_scene import PlotlineScene
from alexandria_core.models.scene import Scene
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.plotline import PlotlineCreate, PlotlineSceneCreate, PlotlineUpdate


class PlotlineScopeError(ValueError):
    """Raised when a referenced ``book_id`` or ``scene_id`` is not in the same
    project as the plotline.

    Surfaced loudly (never silently ignored) so a plotline can never be scoped to
    a book from another project, nor attach a scene from another project
    (cross-project / IDOR leak). The endpoint layer maps this to a 4xx response.
    """


async def _validate_book_in_project(
    db: AsyncSession, project_id: uuid.UUID, book_id: uuid.UUID | None
) -> None:
    """Ensure ``book_id`` (if set) names a Book in ``project_id``.

    ``None`` is always valid (project-wide plotline). A non-existent book, or one
    owned by a different project, raises ``PlotlineScopeError``.
    """
    if book_id is None:
        return
    result = await db.execute(
        select(Book.id).where(Book.id == book_id, Book.project_id == project_id)
    )
    if result.scalar_one_or_none() is None:
        raise PlotlineScopeError(
            f"Book {book_id} does not exist in project {project_id}"
        )


async def _resolve_scene_project(
    db: AsyncSession, scene_id: uuid.UUID
) -> uuid.UUID | None:
    """Resolve scene -> chapter -> book -> project_id, or None if not found."""
    result = await db.execute(
        select(Book.project_id)
        .select_from(Scene)
        .join(Chapter, Scene.chapter_id == Chapter.id)
        .join(Book, Chapter.book_id == Book.id)
        .where(Scene.id == scene_id)
    )
    return result.scalar_one_or_none()


async def create_plotline(
    db: AsyncSession, project_id: uuid.UUID, data: PlotlineCreate
) -> Plotline:
    # A plotline may only be scoped to a book in its OWN project (else reject —
    # no silent cross-project leak). None = project-wide, always valid.
    await _validate_book_in_project(db, project_id, data.book_id)
    plotline = Plotline(project_id=project_id, **data.model_dump())
    db.add(plotline)
    await db.commit()
    await db.refresh(plotline)
    return plotline


async def get_plotline(
    db: AsyncSession, project_id: uuid.UUID, plotline_id: uuid.UUID
) -> Plotline | None:
    result = await db.execute(
        select(Plotline).where(
            Plotline.id == plotline_id,
            Plotline.project_id == project_id,
        )
    )
    return result.scalar_one_or_none()


async def list_plotlines(
    db: AsyncSession, project_id: uuid.UUID
) -> list[Plotline]:
    result = await db.execute(
        select(Plotline)
        .where(Plotline.project_id == project_id)
        .order_by(Plotline.order_index, Plotline.created_at)
    )
    return list(result.scalars().all())


async def update_plotline(
    db: AsyncSession, plotline: Plotline, data: PlotlineUpdate
) -> Plotline:
    payload = data.model_dump(exclude_unset=True)
    # Only validate when book_id is actually being assigned (present in the
    # PATCH). Setting it to None (clearing) is valid; a real id must belong to
    # this plotline's project.
    if "book_id" in payload:
        await _validate_book_in_project(db, plotline.project_id, payload["book_id"])
    for field, value in payload.items():
        setattr(plotline, field, value)
    await db.commit()
    await db.refresh(plotline)
    return plotline


async def delete_plotline(db: AsyncSession, plotline: Plotline) -> None:
    """Delete a plotline; its PlotlineScene links go with it (CASCADE), but the
    scenes themselves are NEVER deleted.

    The ORM relationship is ``cascade="all, delete-orphan"`` so the links are
    removed deterministically regardless of DB-level FK enforcement (SQLite does
    not enforce ``ON DELETE`` unless ``PRAGMA foreign_keys`` is on).
    """
    await db.delete(plotline)
    await db.commit()


# ----------------------------- scene attachment -----------------------------


async def list_plotline_scenes(
    db: AsyncSession, plotline_id: uuid.UUID
) -> list[PlotlineScene]:
    result = await db.execute(
        select(PlotlineScene)
        .where(PlotlineScene.plotline_id == plotline_id)
        .order_by(PlotlineScene.order_index, PlotlineScene.created_at)
    )
    return list(result.scalars().all())


async def attach_scene(
    db: AsyncSession, plotline: Plotline, data: PlotlineSceneCreate
) -> PlotlineScene:
    """Attach a scene to a plotline.

    Rejects (``PlotlineScopeError``) a scene that does not exist or resolves
    (scene -> chapter -> book -> project) to a DIFFERENT project than the
    plotline. Re-attaching a scene already linked to this plotline is idempotent
    (returns the existing link) — the unique constraint on (plotline_id,
    scene_id) is the authoritative guard.
    """
    scene_project = await _resolve_scene_project(db, data.scene_id)
    if scene_project is None:
        raise PlotlineScopeError(f"Scene {data.scene_id} does not exist")
    if scene_project != plotline.project_id:
        raise PlotlineScopeError(
            f"Scene {data.scene_id} belongs to a different project than plotline "
            f"{plotline.id}"
        )

    existing = await db.execute(
        select(PlotlineScene).where(
            PlotlineScene.plotline_id == plotline.id,
            PlotlineScene.scene_id == data.scene_id,
        )
    )
    link = existing.scalar_one_or_none()
    if link is not None:
        # Idempotent: the scene is already attached. Keep the existing link
        # rather than violating the unique constraint.
        return link

    link = PlotlineScene(
        plotline_id=plotline.id,
        scene_id=data.scene_id,
        order_index=data.order_index,
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)
    return link


async def detach_scene(
    db: AsyncSession, plotline: Plotline, scene_id: uuid.UUID
) -> bool:
    """Remove a scene link from a plotline. Returns True if a link was removed.

    The scene itself is never deleted — only the association row.
    """
    result = await db.execute(
        select(PlotlineScene).where(
            PlotlineScene.plotline_id == plotline.id,
            PlotlineScene.scene_id == scene_id,
        )
    )
    link = result.scalar_one_or_none()
    if link is None:
        return False
    await db.delete(link)
    await db.commit()
    return True
