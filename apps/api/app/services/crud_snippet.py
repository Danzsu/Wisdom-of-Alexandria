import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.snippet import Snippet
from app.schemas.snippet import SnippetCreate, SnippetUpdate


async def create_snippet(
    db: AsyncSession, project_id: uuid.UUID, data: SnippetCreate
) -> Snippet:
    snippet = Snippet(project_id=project_id, **data.model_dump())
    db.add(snippet)
    await db.commit()
    await db.refresh(snippet)
    return snippet


async def get_snippet(
    db: AsyncSession, project_id: uuid.UUID, snippet_id: uuid.UUID
) -> Snippet | None:
    result = await db.execute(
        select(Snippet).where(
            Snippet.id == snippet_id, Snippet.project_id == project_id
        )
    )
    return result.scalar_one_or_none()


async def list_snippets(
    db: AsyncSession, project_id: uuid.UUID, tag: str | None = None
) -> list[Snippet]:
    result = await db.execute(
        select(Snippet)
        .where(Snippet.project_id == project_id)
        .order_by(Snippet.created_at)
    )
    snippets = list(result.scalars().all())
    if tag is not None:
        snippets = [s for s in snippets if tag in (s.tags or [])]
    return snippets


async def update_snippet(
    db: AsyncSession, snippet: Snippet, data: SnippetUpdate
) -> Snippet:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(snippet, field, value)
    await db.commit()
    await db.refresh(snippet)
    return snippet


async def delete_snippet(db: AsyncSession, snippet: Snippet) -> None:
    await db.delete(snippet)
    await db.commit()
