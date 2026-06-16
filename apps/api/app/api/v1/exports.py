import unicodedata
import uuid
from typing import Literal
from urllib.parse import quote

from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.scene import Scene
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.services.export_service import (
    export_book_markdown,
    export_chapter_markdown,
    export_scene_markdown,
)
from app.services.pandoc import (
    PandocConversionError,
    PandocFormat,
    PandocUnavailableError,
    convert_markdown,
)

router = APIRouter(tags=["exports"])

ExportScope = Literal["book", "chapter", "scene"]
ExportFormat = Literal["md", "docx", "epub"]

#: File extension + download media type per export format. `md` is the native
#: path; `docx`/`epub` are produced by pandoc.
_FORMAT_EXTENSION: dict[ExportFormat, str] = {
    "md": "md",
    "docx": "docx",
    "epub": "epub",
}
_FORMAT_MEDIA_TYPE: dict[ExportFormat, str] = {
    "md": "text/markdown; charset=utf-8",
    "docx": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ),
    "epub": "application/epub+zip",
}


def _safe_filename(title: str, extension: str) -> str:
    """Return an ASCII-safe filename slug from a title + the format extension."""
    # Strip diacritics via NFKD normalization, then drop non-ASCII
    normalized = unicodedata.normalize("NFKD", title)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    safe = ascii_name.replace(" ", "_") or f"book_{uuid.uuid4().hex[:8]}"
    return f"{safe}.{extension}"


def _disposition(title: str, extension: str) -> str:
    """Build a Content-Disposition value with an ASCII filename + RFC 5987 UTF-8."""
    ascii_filename = _safe_filename(title, extension)
    utf8_filename = quote(f"{title}.{extension}", safe="")
    return f'attachment; filename="{ascii_filename}"; filename*=UTF-8\'\'{utf8_filename}'


def _markdown_response(content: str, title: str) -> Response:
    """Wrap exported Markdown in a text/markdown download Response."""
    return Response(
        content=content.encode("utf-8"),
        media_type=_FORMAT_MEDIA_TYPE["md"],
        headers={"Content-Disposition": _disposition(title, "md")},
    )


def _pandoc_response(markdown: str, title: str, fmt: PandocFormat) -> Response:
    """Convert `markdown` to docx/epub via pandoc and wrap it in a download.

    pandoc-missing -> 503 (actionable), conversion failure -> 502 (sanitized).
    Neither becomes a silent empty download nor a raw 500 traceback.
    """
    try:
        data = convert_markdown(markdown, fmt, title=title)
    except PandocUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except PandocConversionError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    extension = _FORMAT_EXTENSION[fmt]
    return Response(
        content=data,
        media_type=_FORMAT_MEDIA_TYPE[fmt],
        headers={"Content-Disposition": _disposition(title, extension)},
    )


def _export_response(content: str, title: str, fmt: ExportFormat) -> Response:
    """Dispatch the generated Markdown to the right format response."""
    if fmt == "md":
        return _markdown_response(content, title)
    return _pandoc_response(content, title, fmt)


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
    format: ExportFormat = Query(default="md"),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> Response:
    """Export a book / chapter / scene as Markdown, DOCX or EPUB.

    `scope` selects the export tartomány; `target_id` identifies the chapter or
    scene and is REQUIRED for the chapter/scene scopes. `format` selects the
    output: `md` is the native-Python Markdown path; `docx`/`epub` generate the
    same Markdown then convert it via the pandoc CLI (503 if pandoc is missing,
    502 if the conversion fails — never a silent empty download).

    Ownership is validated for EVERY format: the target chapter must belong to
    the book, and the target scene must belong to a chapter of the book (404
    otherwise). The download filename is derived from the scope-appropriate
    title (book / chapter / scene) with the format-correct extension.
    """
    book = await _get_book_or_404(book_id, db)

    if scope == "book":
        content = await export_book_markdown(db, book)
        return _export_response(content, book.title, format)

    if target_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="target_id is required for chapter/scene scope",
        )

    if scope == "chapter":
        chapter = await _get_chapter_in_book_or_404(book_id, target_id, db)
        content = await export_chapter_markdown(db, chapter)
        return _export_response(content, chapter.title, format)

    # scope == "scene"
    scene = await _get_scene_in_book_or_404(book_id, target_id, db)
    content = export_scene_markdown(scene)
    return _export_response(content, scene.title, format)
