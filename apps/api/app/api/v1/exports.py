import unicodedata
import uuid
from typing import Literal
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.book import Book
from app.models.chapter import Chapter
from app.models.scene import Scene
from app.services.export_service import (
    export_book_markdown,
    export_chapter_markdown,
    export_scene_markdown,
)

router = APIRouter(tags=["exports"])

ExportScope = Literal["book", "chapter", "scene"]


def _safe_filename(title: str) -> str:
    """Return an ASCII-safe filename slug from a title."""
    # Strip diacritics via NFKD normalization, then drop non-ASCII
    normalized = unicodedata.normalize("NFKD", title)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    safe = ascii_name.replace(" ", "_") or f"book_{uuid.uuid4().hex[:8]}"
    return f"{safe}.md"


def _disposition(title: str) -> str:
    """Build a Content-Disposition value with an ASCII filename + RFC 5987 UTF-8."""
    ascii_filename = _safe_filename(title)
    utf8_filename = quote(f"{title}.md", safe="")
    return f'attachment; filename="{ascii_filename}"; filename*=UTF-8\'\'{utf8_filename}'


def _markdown_response(content: str, title: str) -> Response:
    """Wrap exported Markdown in a text/markdown download Response."""
    return Response(
        content=content.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": _disposition(title)},
    )


async def _get_book_or_404(book_id: uuid.UUID, db: AsyncSession) -> Book:
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")
    return book


async def _get_chapter_in_book_or_404(
    book_id: uuid.UUID, chapter_id: uuid.UUID, db: AsyncSession
) -> Chapter:
    result = await db.execute(
        select(Chapter).where(
            Chapter.id == chapter_id, Chapter.book_id == book_id
        )
    )
    chapter = result.scalar_one_or_none()
    if chapter is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chapter not found")
    return chapter


async def _get_scene_in_book_or_404(
    book_id: uuid.UUID, scene_id: uuid.UUID, db: AsyncSession
) -> Scene:
    # Join Scene → Chapter so the scene is only found when its chapter belongs to
    # the book — a scene from another book yields a 404 (ownership enforced).
    result = await db.execute(
        select(Scene)
        .join(Chapter, Scene.chapter_id == Chapter.id)
        .where(Scene.id == scene_id, Chapter.book_id == book_id)
    )
    scene = result.scalar_one_or_none()
    if scene is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    return scene


@router.post("/books/{book_id}/exports")
async def export_book(
    book_id: uuid.UUID,
    scope: ExportScope = Query(default="book"),
    target_id: uuid.UUID | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> Response:
    """Export a book / chapter / scene as Markdown.

    `scope` selects the export tartomány; `target_id` identifies the chapter or
    scene and is REQUIRED for the chapter/scene scopes. Ownership is validated:
    the target chapter must belong to the book, and the target scene must belong
    to a chapter of the book (404 otherwise). The download filename is derived
    from the scope-appropriate title (book / chapter / scene).
    """
    book = await _get_book_or_404(book_id, db)

    if scope == "book":
        content = await export_book_markdown(db, book)
        return _markdown_response(content, book.title)

    if target_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="target_id is required for chapter/scene scope",
        )

    if scope == "chapter":
        chapter = await _get_chapter_in_book_or_404(book_id, target_id, db)
        content = await export_chapter_markdown(db, chapter)
        return _markdown_response(content, chapter.title)

    # scope == "scene"
    scene = await _get_scene_in_book_or_404(book_id, target_id, db)
    content = export_scene_markdown(scene)
    return _markdown_response(content, scene.title)
