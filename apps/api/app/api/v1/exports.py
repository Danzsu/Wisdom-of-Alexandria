import unicodedata
import uuid
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.book import Book
from app.services.export_service import export_book_markdown

router = APIRouter(tags=["exports"])


def _safe_filename(title: str) -> str:
    """Return an ASCII-safe filename slug from a title."""
    # Strip diacritics via NFKD normalization, then drop non-ASCII
    normalized = unicodedata.normalize("NFKD", title)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    safe = ascii_name.replace(" ", "_") or f"book_{uuid.uuid4().hex[:8]}"
    return f"{safe}.md"


@router.post("/books/{book_id}/exports")
async def export_book(
    book_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> Response:
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if book is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Book not found")

    content = await export_book_markdown(db, book)
    ascii_filename = _safe_filename(book.title)
    # RFC 5987: also provide UTF-8 encoded filename* for clients that support it
    utf8_filename = quote(f"{book.title}.md", safe="")
    disposition = f'attachment; filename="{ascii_filename}"; filename*=UTF-8\'\'{utf8_filename}'

    return Response(
        content=content.encode("utf-8"),
        media_type="text/markdown; charset=utf-8",
        headers={"Content-Disposition": disposition},
    )
