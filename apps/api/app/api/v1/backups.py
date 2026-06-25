"""Project JSON backup/restore endpoints (Feature #5).

* ``GET  /projects/{project_id}/backup`` — ownership-checked → returns the whole
  project graph as a downloadable ``application/json`` file (Content-Disposition
  with a ``<slug>-backup.json`` filename).
* ``POST /projects/restore`` — accepts a MULTIPART ``.json`` file upload (mirrors
  the DOCX-import contract) → restores into a BRAND-NEW project → returns a
  {@link RestoreSummary} with the new project id + per-collection counts.

A backup NEVER contains provider secrets / embeddings / jobs / revisions (see
``app.services.backup_service`` module docstring). Restore is transactional — a
malformed or unsupported payload yields a clear 400/422 (never a 500 traceback)
and never leaves a partial project behind.
"""

import json
import unicodedata
import uuid
from urllib.parse import quote

from alexandria_core.models.beat import Beat
from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.character import Character
from alexandria_core.models.codex_entry import CodexEntry
from alexandria_core.models.codex_progression import CodexProgression
from alexandria_core.models.codex_relation import CodexRelation
from alexandria_core.models.location import Location
from alexandria_core.models.scene import Scene
from alexandria_core.models.series import Series
from alexandria_core.models.snippet import Snippet
from alexandria_core.models.style_guide import StyleGuide
from alexandria_core.models.worldbuilding_entry import WorldbuildingEntry
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.core.uploads import read_upload_capped
from app.schemas.backup import RestoreSummary
from app.services.backup_service import (
    BackupError,
    export_project,
    restore_project,
)
from app.services.crud_project import get_project

router = APIRouter(tags=["backups"])

#: Restore upload size cap. A backup is JSON text; even a large novel project is
#: a few MB. 50 MiB is a generous ceiling that still rejects an absurd upload
#: (-> 413) before it is parsed.
_MAX_UPLOAD_BYTES = 50 * 1024 * 1024


def _safe_slug(title: str) -> str:
    """ASCII-safe filename slug from a project title (matches export.py)."""
    normalized = unicodedata.normalize("NFKD", title)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_name.replace(" ", "_") or f"project_{uuid.uuid4().hex[:8]}"


def _disposition(title: str) -> str:
    """Content-Disposition with an ASCII filename + RFC 5987 UTF-8 fallback."""
    ascii_name = f"{_safe_slug(title)}-backup.json"
    utf8_name = quote(f"{title}-backup.json", safe="")
    return f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{utf8_name}"


@router.get("/projects/{project_id}/backup")
async def backup(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> Response:
    """Download a project's whole graph as a JSON backup file.

    Ownership-checked (a missing/foreign project → 404, matching the existing
    single-user pattern). Provider secrets / embeddings / jobs / revisions are
    excluded by the serializer.
    """
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )

    envelope = await export_project(db, project_id)
    body = json.dumps(envelope, ensure_ascii=False).encode("utf-8")
    return Response(
        content=body,
        media_type="application/json",
        headers={"Content-Disposition": _disposition(project.title)},
    )


async def _count(db: AsyncSession, model, *where) -> int:  # type: ignore[no-untyped-def]
    result = await db.execute(select(func.count()).select_from(model).where(*where))
    return int(result.scalar_one())


@router.post(
    "/projects/restore",
    response_model=RestoreSummary,
    status_code=status.HTTP_201_CREATED,
)
async def restore(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> RestoreSummary:
    """Restore a JSON backup file into a brand-new project.

    The upload is the JSON envelope produced by ``GET .../backup``. Errors map to
    clear HTTP codes (never a 500 traceback):

      * empty upload          -> 400
      * over the size cap     -> 413
      * not valid JSON        -> 400
      * malformed / wrong
        version / shape       -> 422 (BackupError)

    The restore is transactional — a failure rolls back, leaving no orphan
    project.
    """
    # Read in bounded chunks: an oversize body aborts with 413 BEFORE the whole
    # request is buffered into RAM (so a huge upload cannot OOM the worker). The
    # cap value is unchanged.
    raw = await read_upload_capped(file, max_bytes=_MAX_UPLOAD_BYTES)
    if len(raw) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is empty.",
        )

    try:
        payload = json.loads(raw.decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded file is not valid JSON.",
        ) from exc

    try:
        project = await restore_project(db, payload)
    except BackupError as exc:
        # Malformed / unsupported-version payload — a client error, not a 500.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc

    book_ids = [
        b
        for (b,) in (
            await db.execute(select(Book.id).where(Book.project_id == project.id))
        ).all()
    ]
    chapter_ids = [
        c
        for (c,) in (
            (
                await db.execute(
                    select(Chapter.id).where(Chapter.book_id.in_(book_ids))
                )
            ).all()
            if book_ids
            else []
        )
    ]
    scene_ids = [
        s
        for (s,) in (
            (
                await db.execute(
                    select(Scene.id).where(Scene.chapter_id.in_(chapter_ids))
                )
            ).all()
            if chapter_ids
            else []
        )
    ]

    return RestoreSummary(
        project_id=project.id,
        title=project.title,
        series_count=await _count(db, Series, Series.project_id == project.id),
        book_count=len(book_ids),
        chapter_count=len(chapter_ids),
        scene_count=len(scene_ids),
        beat_count=(
            await _count(db, Beat, Beat.scene_id.in_(scene_ids)) if scene_ids else 0
        ),
        codex_entry_count=await _count(
            db, CodexEntry, CodexEntry.project_id == project.id
        ),
        character_count=await _count(
            db, Character, Character.project_id == project.id
        ),
        location_count=await _count(
            db, Location, Location.project_id == project.id
        ),
        worldbuilding_count=await _count(
            db, WorldbuildingEntry, WorldbuildingEntry.project_id == project.id
        ),
        snippet_count=await _count(
            db, Snippet, Snippet.project_id == project.id
        ),
        style_guide_count=await _count(
            db, StyleGuide, StyleGuide.project_id == project.id
        ),
        codex_relation_count=await _count(
            db, CodexRelation, CodexRelation.project_id == project.id
        ),
        codex_progression_count=(
            await _count(
                db,
                CodexProgression,
                (CodexProgression.chapter_id.in_(chapter_ids))
                | (CodexProgression.scene_id.in_(scene_ids)),
            )
            if (chapter_ids or scene_ids)
            else 0
        ),
    )
