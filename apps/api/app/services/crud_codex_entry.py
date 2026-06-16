import uuid

from alexandria_core.models.codex_entry import CodexEntry
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.codex_entry import CodexEntryCreate, CodexEntryUpdate
from app.services.crud_series import validate_series_in_project


async def create_codex_entry(
    db: AsyncSession, project_id: uuid.UUID, data: CodexEntryCreate
) -> CodexEntry:
    # series_id None = project-global; set must reference a series in THIS
    # project (else reject — no silent cross-project leak).
    await validate_series_in_project(db, project_id, data.series_id)
    entry = CodexEntry(project_id=project_id, **data.model_dump())
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


async def get_codex_entry(
    db: AsyncSession, project_id: uuid.UUID, entry_id: uuid.UUID
) -> CodexEntry | None:
    result = await db.execute(
        select(CodexEntry).where(
            CodexEntry.id == entry_id,
            CodexEntry.project_id == project_id,
        )
    )
    return result.scalar_one_or_none()


async def list_codex_entries(
    db: AsyncSession,
    project_id: uuid.UUID,
    series_id: uuid.UUID | None = None,
) -> list[CodexEntry]:
    """List a project's codex entries, optionally filtered by series scope.

    Scope semantics:
      - ``series_id`` is None (no filter): return ALL entries in the project.
      - ``series_id`` is given: return project-global entries (``series_id IS
        NULL``) PLUS entries scoped to that series — and EXCLUDE entries scoped
        to any OTHER series.
    """
    stmt = select(CodexEntry).where(CodexEntry.project_id == project_id)
    if series_id is not None:
        stmt = stmt.where(
            (CodexEntry.series_id.is_(None))
            | (CodexEntry.series_id == series_id)
        )
    result = await db.execute(stmt.order_by(CodexEntry.title))
    return list(result.scalars().all())


async def update_codex_entry(
    db: AsyncSession, entry: CodexEntry, data: CodexEntryUpdate
) -> CodexEntry:
    payload = data.model_dump(exclude_unset=True)
    # Validate only when series_id is being assigned; clearing to None is valid.
    if "series_id" in payload:
        await validate_series_in_project(
            db, entry.project_id, payload["series_id"]
        )
    for field, value in payload.items():
        setattr(entry, field, value)
    await db.commit()
    await db.refresh(entry)
    return entry


async def delete_codex_entry(db: AsyncSession, entry: CodexEntry) -> None:
    await db.delete(entry)
    await db.commit()
