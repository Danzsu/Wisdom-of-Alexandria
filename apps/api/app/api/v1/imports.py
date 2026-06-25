"""DOCX import endpoint (#2b): upload a ``.docx`` → create a Book subtree.

Flow: validate the project (exists/owned → 404) + the upload (``.docx`` only →
400; size cap → 413) → read the bytes → ``convert_docx_to_markdown`` (pandoc) →
``parse_manuscript_markdown`` → ``create_book_from_parsed`` (Book + Chapters +
Scenes in ONE transaction). Every failure is mapped to a clear HTTP code and the
create is transactional, so a conversion/parse/DB failure never leaves a partial
book behind (the session is rolled back, no orphan rows):

  * pandoc not installed        -> PandocUnavailableError -> 503 (actionable)
  * pandoc conversion failed     -> PandocConversionError  -> 502 (sanitized)
  * empty doc / parse yields nada-> 422 (clear message)
  * non-.docx upload             -> 400
  * upload over the size cap     -> 413
"""

import uuid

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.text import count_words
from app.core.uploads import read_upload_capped
from app.schemas.import_ import BookImportSummary
from app.services.crud_project import get_project
from app.services.import_service import (
    create_book_from_parsed,
    parse_manuscript_markdown,
)
from app.services.pandoc import (
    PandocConversionError,
    PandocUnavailableError,
    convert_docx_to_markdown,
)

router = APIRouter(prefix="/projects/{project_id}/imports", tags=["imports"])

#: DOCX content type (Office Open XML wordprocessing document).
_DOCX_CONTENT_TYPE = (
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
)

#: Upload size cap. A manuscript DOCX is a few MB at most; 25 MiB is a generous
#: ceiling that still rejects an absurd/abusive upload (-> 413) before it is
#: handed to pandoc.
_MAX_UPLOAD_BYTES = 25 * 1024 * 1024


def _looks_like_docx(file: UploadFile) -> bool:
    """True when the upload is a ``.docx`` by content-type OR filename extension.

    Either signal is accepted (browsers/clients are inconsistent about the
    multipart content-type), but a non-docx with neither is rejected.
    """
    if file.content_type == _DOCX_CONTENT_TYPE:
        return True
    name = (file.filename or "").lower()
    return name.endswith(".docx")


def _filename_stem(file: UploadFile) -> str:
    """Best-effort book title from the filename (stem, ``.docx`` stripped)."""
    name = (file.filename or "").rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    if name.lower().endswith(".docx"):
        name = name[: -len(".docx")]
    return name.strip()


@router.post(
    "",
    response_model=BookImportSummary,
    status_code=status.HTTP_201_CREATED,
)
async def import_docx(
    project_id: uuid.UUID,
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> BookImportSummary:
    """Import a ``.docx`` as a new Book (with Chapters + Scenes) under a project.

    The optional ``title`` form field overrides the title; otherwise the parsed
    single-line preamble title, then the uploaded filename stem, is used. See the
    module docstring for the error → HTTP mapping. The persisted structure is
    transactional — a failure rolls back and never leaves an orphan book.
    """
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    if not _looks_like_docx(file):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .docx files can be imported.",
        )

    # Read in bounded chunks: an oversize body aborts with 413 BEFORE the whole
    # request is buffered into RAM (so a huge upload cannot OOM the worker). The
    # cap value is unchanged.
    docx_bytes = await read_upload_capped(file, max_bytes=_MAX_UPLOAD_BYTES)
    if len(docx_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    try:
        markdown = convert_docx_to_markdown(docx_bytes)
    except PandocUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    except PandocConversionError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)
        ) from exc

    form_title = (title or "").strip()
    parsed = parse_manuscript_markdown(
        markdown, default_book_title=form_title or _filename_stem(file)
    )

    if not parsed.chapters:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                "The document produced no importable content "
                "(it appears to be empty)."
            ),
        )

    resolved_title = (
        form_title or parsed.title or _filename_stem(file) or "Importált könyv"
    )

    try:
        book = await create_book_from_parsed(
            db,
            project_id,
            parsed,
            title=resolved_title,
            language=project.language or "hu",
        )
    except Exception:
        # Any failure during the build/commit must not leave a partial book.
        await db.rollback()
        raise

    chapter_count = len(parsed.chapters)
    scene_count = sum(len(c.scenes) for c in parsed.chapters)
    word_count = sum(
        count_words(s.content) for c in parsed.chapters for s in c.scenes
    )

    return BookImportSummary(
        book_id=book.id,
        title=book.title,
        chapter_count=chapter_count,
        scene_count=scene_count,
        word_count=word_count,
    )
