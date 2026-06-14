from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book
from app.models.chapter import Chapter
from app.models.scene import Scene, SceneStatus


async def export_book_markdown(db: AsyncSession, book: Book) -> str:
    """Generate full Markdown export for a book."""
    lines: list[str] = []

    # Title
    lines.append(f"# {book.title}")
    lines.append("")

    # Metadata line
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

    # Chapters
    chapters_result = await db.execute(
        select(Chapter)
        .where(Chapter.book_id == book.id)
        .order_by(Chapter.order_index, Chapter.created_at)
    )
    chapters = list(chapters_result.scalars().all())

    for ch_idx, chapter in enumerate(chapters, start=1):
        lines.append(f"## {ch_idx}. {chapter.title}")
        lines.append("")
        if chapter.summary:
            lines.append(chapter.summary)
            lines.append("")

        # Scenes (exclude archived)
        scenes_result = await db.execute(
            select(Scene)
            .where(Scene.chapter_id == chapter.id, Scene.status != SceneStatus.ARCHIVED)
            .order_by(Scene.order_index, Scene.created_at)
        )
        scenes = list(scenes_result.scalars().all())

        for sc_idx, scene in enumerate(scenes, start=1):
            lines.append(f"### {ch_idx}.{sc_idx} {scene.title}")
            lines.append("")
            if scene.content:
                lines.append(scene.content)
            else:
                lines.append("*[üres jelenet]*")
            lines.append("")

        lines.append("---")
        lines.append("")

    return "\n".join(lines)
