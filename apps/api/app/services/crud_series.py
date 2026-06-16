import uuid

from alexandria_core.models.book import Book
from alexandria_core.models.codex_entry import CodexEntry
from alexandria_core.models.series import Series
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.series import SeriesCreate, SeriesUpdate


class SeriesScopeError(ValueError):
    """Raised when a ``series_id`` does not belong to the expected project.

    Surfaced loudly (never silently ignored) so a book/codex entry can never be
    attached to a series from a different project (cross-project scope leak). The
    endpoint layer maps this to a 4xx response.
    """


async def create_series(
    db: AsyncSession, project_id: uuid.UUID, data: SeriesCreate
) -> Series:
    series = Series(project_id=project_id, **data.model_dump())
    db.add(series)
    await db.commit()
    await db.refresh(series)
    return series


async def get_series(
    db: AsyncSession, project_id: uuid.UUID, series_id: uuid.UUID
) -> Series | None:
    result = await db.execute(
        select(Series).where(
            Series.id == series_id,
            Series.project_id == project_id,
        )
    )
    return result.scalar_one_or_none()


async def list_series(db: AsyncSession, project_id: uuid.UUID) -> list[Series]:
    result = await db.execute(
        select(Series)
        .where(Series.project_id == project_id)
        .order_by(Series.order_index, Series.created_at)
    )
    return list(result.scalars().all())


async def update_series(
    db: AsyncSession, series: Series, data: SeriesUpdate
) -> Series:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(series, field, value)
    await db.commit()
    await db.refresh(series)
    return series


async def delete_series(db: AsyncSession, series: Series) -> None:
    """Delete a series; its books and codex entries fall back to project-only.

    The DB-level FK is ``ON DELETE SET NULL`` (authoritative on PostgreSQL), but
    we ALSO null the references explicitly here so the behaviour is deterministic
    and portable regardless of whether the backend enforces FKs (SQLite does not
    enforce ``ON DELETE`` actions unless ``PRAGMA foreign_keys`` is on). Books and
    codex entries are NEVER deleted with the series — only detached.
    """
    await db.execute(
        update(Book)
        .where(Book.series_id == series.id)
        .values(series_id=None)
    )
    await db.execute(
        update(CodexEntry)
        .where(CodexEntry.series_id == series.id)
        .values(series_id=None)
    )
    await db.delete(series)
    await db.commit()


async def validate_series_in_project(
    db: AsyncSession, project_id: uuid.UUID, series_id: uuid.UUID | None
) -> None:
    """Ensure ``series_id`` (if set) names a Series in ``project_id``.

    ``None`` is always valid (project-global / no series). A non-existent series,
    or one owned by a different project, raises ``SeriesScopeError`` — preventing
    a silent cross-project scope leak.
    """
    if series_id is None:
        return
    series = await get_series(db, project_id, series_id)
    if series is None:
        raise SeriesScopeError(
            f"Series {series_id} does not exist in project {project_id}"
        )
