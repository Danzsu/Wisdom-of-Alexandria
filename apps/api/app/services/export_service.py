import logging
import uuid
from pathlib import Path

from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.media_asset import MediaAsset
from alexandria_core.models.scene import Scene, SceneStatus
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def resolve_book_cover_path(
    db: AsyncSession, book_id: uuid.UUID
) -> str | None:
    """Resolve the book's canonical READY cover to its on-disk file path.

    The cover generator (apps/ai) stores covers as MediaAsset rows
    (entity_type="cover", entity_id=book.id) with the binary under the shared
    media_dir. Only a cover that is canonical AND ready AND actually present on
    disk is embeddable. Every miss returns None — an export must NEVER fail
    over a cover:

      * no matching row              -> None (export exactly as before)
      * row exists, file missing     -> WARNING logged + None (graceful skip)
    """
    result = await db.execute(
        select(MediaAsset)
        .where(
            MediaAsset.entity_type == "cover",
            MediaAsset.entity_id == book_id,
            MediaAsset.is_canonical.is_(True),
            MediaAsset.status == "ready",
            MediaAsset.file_path.is_not(None),
        )
        .order_by(MediaAsset.created_at.desc())
    )
    asset = result.scalars().first()
    if asset is None or not asset.file_path:
        return None
    if not Path(asset.file_path).is_file():
        logger.warning(
            "Canonical cover %s for book %s points to a missing file (%s); "
            "exporting without a cover.",
            asset.id,
            book_id,
            asset.file_path,
        )
        return None
    return asset.file_path


async def _fetch_chapters(db: AsyncSession, book_id) -> list[Chapter]:
    """Fetch a book's chapters in canonical order (order_index, created_at)."""
    result = await db.execute(
        select(Chapter)
        .where(Chapter.book_id == book_id)
        .order_by(Chapter.order_index, Chapter.created_at)
    )
    return list(result.scalars().all())


async def _fetch_scenes(db: AsyncSession, chapter_id) -> list[Scene]:
    """Fetch a chapter's non-archived scenes in canonical order."""
    result = await db.execute(
        select(Scene)
        .where(Scene.chapter_id == chapter_id, Scene.status != SceneStatus.ARCHIVED)
        .order_by(Scene.order_index, Scene.created_at)
    )
    return list(result.scalars().all())


def _render_scene(lines: list[str], scene: Scene, heading: str) -> None:
    """Append a scene block (H3 heading + content / empty marker) to `lines`."""
    lines.append(f"### {heading} {scene.title}")
    lines.append("")
    if scene.content:
        lines.append(scene.content)
    else:
        lines.append("*[üres jelenet]*")
    lines.append("")


async def _render_chapter(
    db: AsyncSession, lines: list[str], chapter: Chapter, ch_idx: int
) -> None:
    """Append a chapter block (H2 + summary + its non-archived scenes) to `lines`."""
    lines.append(f"## {ch_idx}. {chapter.title}")
    lines.append("")
    if chapter.summary:
        lines.append(chapter.summary)
        lines.append("")

    scenes = await _fetch_scenes(db, chapter.id)
    for sc_idx, scene in enumerate(scenes, start=1):
        _render_scene(lines, scene, f"{ch_idx}.{sc_idx}")

    lines.append("---")
    lines.append("")


def _render_book_header(lines: list[str], book: Book) -> None:
    """Append the book title + metadata + description + separator to `lines`."""
    lines.append(f"# {book.title}")
    lines.append("")

    meta_parts = []
    if book.genre:
        meta_parts.append(book.genre)
    if book.language:
        meta_parts.append(book.language)
    if book.word_count_target:
        meta_parts.append(f"{book.word_count_target} szó")
    if meta_parts:
        lines.append(f"*{' · '.join(meta_parts)}*")
        lines.append("")

    if book.description:
        lines.append(book.description)
        lines.append("")

    lines.append("---")
    lines.append("")


async def export_book_markdown(db: AsyncSession, book: Book) -> str:
    """Generate full Markdown export for a book (H1 → H2 chapters → H3 scenes)."""
    lines: list[str] = []
    _render_book_header(lines, book)

    chapters = await _fetch_chapters(db, book.id)
    for ch_idx, chapter in enumerate(chapters, start=1):
        await _render_chapter(db, lines, chapter, ch_idx)

    return "\n".join(lines)


async def export_chapter_markdown(db: AsyncSession, chapter: Chapter) -> str:
    """Generate Markdown export for a single chapter (H2 + summary + its scenes).

    Numbered "1." since the chapter is exported standalone; reuses the same
    chapter rendering helper as the whole-book path.
    """
    lines: list[str] = []
    await _render_chapter(db, lines, chapter, 1)
    return "\n".join(lines)


def export_scene_markdown(scene: Scene) -> str:
    """Generate Markdown export for a single scene (H3 + content).

    Needs no DB access (the scene row already carries its content), so this is a
    plain sync function — the endpoint dispatches it without `await`.
    """
    lines: list[str] = []
    _render_scene(lines, scene, "1.1")
    return "\n".join(lines)
