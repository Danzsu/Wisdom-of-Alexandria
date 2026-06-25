import uuid

from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.project import Project
from alexandria_core.models.scene import Scene
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate


def _book_count_subquery():
    """Correlated scalar subquery: number of books in a project."""
    return (
        select(func.count(Book.id))
        .where(Book.project_id == Project.id)
        .correlate(Project)
        .scalar_subquery()
    )


def _word_count_subquery():
    """Correlated scalar subquery: total Scene.word_count across the whole project.

    Walks the FK chain Scene → Chapter → Book → Project and coalesces a null SUM
    (a project with no scenes) to 0. Archived scenes are excluded to match the
    archived-exclusion applied everywhere else (crud_scene.list_scenes, exports).
    """
    return (
        select(func.coalesce(func.sum(Scene.word_count), 0))
        .select_from(Scene)
        .join(Chapter, Scene.chapter_id == Chapter.id)
        .join(Book, Chapter.book_id == Book.id)
        .where(Book.project_id == Project.id, Scene.status != "archived")
        .correlate(Project)
        .scalar_subquery()
    )


def _scene_count_subquery():
    """Correlated scalar subquery: number of non-archived Scenes across the project.

    Walks the same FK chain as ``_word_count_subquery`` (Scene → Chapter → Book →
    Project) and applies the identical archived-exclusion so ``scene_count`` and
    ``word_count`` stay consistent (a scene that doesn't count its words also
    doesn't count toward the scene total).
    """
    return (
        select(func.count(Scene.id))
        .select_from(Scene)
        .join(Chapter, Scene.chapter_id == Chapter.id)
        .join(Book, Chapter.book_id == Book.id)
        .where(Book.project_id == Project.id, Scene.status != "archived")
        .correlate(Project)
        .scalar_subquery()
    )


def _to_read(
    project: Project, book_count: int, word_count: int, scene_count: int
) -> ProjectRead:
    """Build a ProjectRead from a Project plus its computed aggregates."""
    return ProjectRead.model_validate(project).model_copy(
        update={
            "book_count": book_count,
            "word_count": word_count,
            "scene_count": scene_count,
        }
    )


async def create_project(db: AsyncSession, data: ProjectCreate) -> Project:
    project = Project(**data.model_dump())
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


async def get_project(db: AsyncSession, project_id: uuid.UUID) -> Project | None:
    result = await db.execute(select(Project).where(Project.id == project_id))
    return result.scalar_one_or_none()


async def get_project_read(
    db: AsyncSession, project_id: uuid.UUID
) -> ProjectRead | None:
    """Fetch one project WITH its aggregates as a single query (no N+1)."""
    result = await db.execute(
        select(
            Project,
            _book_count_subquery(),
            _word_count_subquery(),
            _scene_count_subquery(),
        ).where(Project.id == project_id)
    )
    row = result.first()
    if row is None:
        return None
    project, book_count, word_count, scene_count = row
    return _to_read(project, book_count, word_count, scene_count)


async def list_projects_read(
    db: AsyncSession, skip: int = 0, limit: int = 100
) -> list[ProjectRead]:
    """List projects WITH aggregates in ONE query (correlated subqueries, no N+1).

    Keeps the existing pagination + newest-first ordering.
    """
    result = await db.execute(
        select(
            Project,
            _book_count_subquery(),
            _word_count_subquery(),
            _scene_count_subquery(),
        )
        .offset(skip)
        .limit(limit)
        .order_by(Project.created_at.desc())
    )
    return [
        _to_read(project, book_count, word_count, scene_count)
        for project, book_count, word_count, scene_count in result.all()
    ]


async def update_project(db: AsyncSession, project: Project, data: ProjectUpdate) -> Project:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    await db.commit()
    await db.refresh(project)
    return project


async def delete_project(db: AsyncSession, project: Project) -> None:
    await db.delete(project)
    await db.commit()
