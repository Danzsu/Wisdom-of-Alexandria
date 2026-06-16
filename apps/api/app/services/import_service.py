"""Pure Markdown → chapter/scene structure parser for the DOCX import (#2b).

The import pipeline is: ``.docx`` upload → pandoc converts it to Markdown (see
``app.services.pandoc.convert_docx_to_markdown``) → THIS module parses that
Markdown into a ``ParsedBook`` tree → the endpoint persists it as a new Book
with Chapters + Scenes.

This module is deliberately PANDOC-FREE and side-effect-free: it takes a string
and returns dataclasses, so the whole heuristic is deterministic and unit
testable without any binary, DB or network. Word counts are NOT computed here —
they are derived at create time via ``app.core.text.count_words`` so the import
path and the editor/approve paths share one source of truth.

Heuristic (kept deliberately SIMPLE — a manuscript, not arbitrary Markdown):

  * A top-level ATX heading (``# ``) starts a new CHAPTER; the heading text is
    the chapter title.
  * Within a chapter, the body is split into SCENES on either an ``## `` (H2)
    heading OR a horizontal rule (``---`` / ``***`` / ``* * *`` and similar). A
    scene introduced by an H2 takes that heading as its title; otherwise it is
    named ``"{n}. jelenet"`` (1-based within its chapter). A chapter with no H2
    and no rule becomes ONE scene.
  * PREAMBLE (content before the first ``# ``):
      - if it is effectively a SINGLE non-empty line, it is treated as the book
        TITLE (the common "title on the first line" manuscript shape) and is NOT
        emitted as a chapter;
      - otherwise (multiple lines of real prose) it becomes a leading chapter
        titled ``"Bevezető"`` so no text is silently dropped.
  * NO headings at all → a single chapter ``"1. fejezet"`` whose one scene is the
    whole body (so a plain-prose docx still imports cleanly).
  * Whitespace is normalized: each scene's content is stripped of leading/
    trailing blank lines; a document that is empty/whitespace-only yields a
    ``ParsedBook`` with NO chapters (the endpoint maps that to a 422 — never a
    silent empty book).

The book title resolution order at the endpoint is: explicit form title →
``ParsedBook.title`` (the single-line preamble, if any) → uploaded filename
stem. ``ParsedBook.title`` is therefore only set from a single-line preamble.
"""

from __future__ import annotations

import re
import uuid
from dataclasses import dataclass, field

from alexandria_core.models.book import Book
from alexandria_core.models.chapter import Chapter
from alexandria_core.models.scene import Scene
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.text import count_words

#: Matches an ATX H1 line: ``# Title`` (one leading ``#`` then a space). A line
#: with two or more hashes is NOT an H1 (it is an H2+ and handled separately).
_H1_RE = re.compile(r"^#\s+(?P<title>.+?)\s*#*\s*$")

#: Matches an ATX H2 line: ``## Title``. Three+ hashes are treated as scene
#: prose, not a split point (manuscripts don't nest deeper for structure).
_H2_RE = re.compile(r"^##\s+(?P<title>.+?)\s*#*\s*$")

#: Matches a Markdown thematic break / horizontal rule used as a scene break:
#: three or more ``-``, ``*`` or ``_`` (optionally separated by spaces).
_HR_RE = re.compile(r"^\s*([-*_])(?:\s*\1){2,}\s*$")

#: Books/chapters/scenes all cap title at 255 chars (see the SQLAlchemy models /
#: Pydantic schemas). Truncate defensively so a runaway heading can't 500 on
#: insert; the parser is the last place that can guarantee a valid length.
_MAX_TITLE_LEN = 255


@dataclass
class ParsedScene:
    """One scene: a title plus its (already-normalized) body content."""

    title: str
    content: str


@dataclass
class ParsedChapter:
    """One chapter: a title plus an ordered list of scenes."""

    title: str
    scenes: list[ParsedScene] = field(default_factory=list)


@dataclass
class ParsedBook:
    """The parsed manuscript: an optional title + ordered chapters.

    ``title`` is only populated when the document's preamble was a single line
    (the "title on line one" shape); otherwise it is ``None`` and the caller
    falls back to the form title or the filename stem.
    """

    title: str | None
    chapters: list[ParsedChapter] = field(default_factory=list)


def _clip_title(text: str) -> str:
    """Collapse whitespace in a heading and clip to the model's max length."""
    collapsed = " ".join(text.split())
    return collapsed[:_MAX_TITLE_LEN]


def _normalize_block(lines: list[str]) -> str:
    """Join body lines and strip surrounding blank lines (keep interior ones)."""
    return "\n".join(lines).strip()


def _is_hr(line: str) -> bool:
    return bool(_HR_RE.match(line))


def _split_chapter_body_into_scenes(body_lines: list[str]) -> list[ParsedScene]:
    """Split one chapter's raw lines into scenes on H2 headings / horizontal rules.

    Returns at least one scene whenever the body has any non-blank content. A
    chapter whose body is entirely blank yields a single empty-content scene
    titled ``"1. jelenet"`` so the chapter is never sceneless (the create path
    stores empty content as word_count 0 — explicit, not silently dropped).
    """
    scenes: list[ParsedScene] = []
    pending_title: str | None = None
    current: list[str] = []

    def flush() -> None:
        # Emit a scene when there is buffered content OR an explicit H2 title.
        # A bare horizontal rule with no following content does not create an
        # empty trailing scene.
        content = _normalize_block(current)
        if not content and pending_title is None:
            return
        title = pending_title or f"{len(scenes) + 1}. jelenet"
        scenes.append(ParsedScene(title=_clip_title(title), content=content))

    for line in body_lines:
        h2 = _H2_RE.match(line)
        if h2:
            flush()
            pending_title = h2.group("title")
            current = []
            continue
        if _is_hr(line):
            flush()
            pending_title = None
            current = []
            continue
        current.append(line)

    flush()

    if not scenes:
        # Whole body was blank: keep one explicit empty scene so the chapter is
        # structurally valid rather than silently dropped.
        scenes.append(ParsedScene(title="1. jelenet", content=""))
    return scenes


def parse_manuscript_markdown(
    md: str, *, default_book_title: str
) -> ParsedBook:
    """Parse manuscript Markdown into a ``ParsedBook`` (chapters → scenes).

    See the module docstring for the full heuristic. ``default_book_title`` is
    accepted for symmetry / future use (e.g. a synthetic single-chapter title)
    but the resolved book title is decided by the caller; this function only
    sets ``ParsedBook.title`` from a single-line preamble.

    Returns a ``ParsedBook`` with an empty ``chapters`` list when ``md`` is
    empty or whitespace-only — the endpoint turns that into a 422 rather than
    creating an empty book.
    """
    text = (md or "").replace("\r\n", "\n").replace("\r", "\n")
    if not text.strip():
        return ParsedBook(title=None, chapters=[])

    lines = text.split("\n")

    # Partition into (preamble lines, [(chapter_title, body_lines), ...]).
    preamble: list[str] = []
    chapter_blocks: list[tuple[str, list[str]]] = []
    current_title: str | None = None
    current_body: list[str] = []
    seen_h1 = False

    def close_chapter() -> None:
        if current_title is not None:
            chapter_blocks.append((current_title, current_body))

    for line in lines:
        h1 = _H1_RE.match(line)
        if h1:
            if not seen_h1:
                seen_h1 = True
            else:
                close_chapter()
            current_title = h1.group("title")
            current_body = []
            continue
        if seen_h1:
            current_body.append(line)
        else:
            preamble.append(line)
    close_chapter()

    # --- no headings at all ------------------------------------------------ #
    # Whole document is heading-free prose (non-empty — the empty case returned
    # above): ONE chapter "1. fejezet" with one scene = the whole body. This rule
    # wins over the preamble handling so plain-prose docs import predictably.
    if not seen_h1:
        return ParsedBook(
            title=None,
            chapters=[
                ParsedChapter(
                    title="1. fejezet",
                    scenes=_split_chapter_body_into_scenes(lines),
                )
            ],
        )

    chapters: list[ParsedChapter] = []
    book_title: str | None = None

    # --- preamble handling (only when at least one H1 chapter follows) ----- #
    preamble_text = _normalize_block(preamble)
    if preamble_text:
        non_blank = [ln for ln in preamble_text.split("\n") if ln.strip()]
        if len(non_blank) == 1:
            # Single line of preamble → the book title (not a chapter).
            book_title = _clip_title(non_blank[0])
        else:
            # Real multi-line prose before the first heading → keep it as a
            # leading "Bevezető" chapter so nothing is dropped.
            chapters.append(
                ParsedChapter(
                    title="Bevezető",
                    scenes=_split_chapter_body_into_scenes(preamble),
                )
            )

    # --- chapter bodies ---------------------------------------------------- #
    for title, body in chapter_blocks:
        chapters.append(
            ParsedChapter(
                title=_clip_title(title),
                scenes=_split_chapter_body_into_scenes(body),
            )
        )

    return ParsedBook(title=book_title, chapters=chapters)


async def create_book_from_parsed(
    db: AsyncSession,
    project_id: uuid.UUID,
    parsed: ParsedBook,
    *,
    title: str,
    language: str = "hu",
) -> Book:
    """Persist a ``ParsedBook`` as a Book + Chapters + Scenes in ONE transaction.

    Builds the whole subtree in memory (Book → Chapters → Scenes, each densely
    ordered via ``order_index``) and commits once. ``word_count`` for every scene
    is computed with :func:`app.core.text.count_words` so the import path matches
    the editor/approve paths exactly. Scene ``status`` defaults to ``"draft"``.

    The single commit is the transactional guarantee the endpoint relies on: if
    anything fails before/at the commit, the caller rolls the session back and NO
    partial book/chapters are left behind (no orphan rows). The caller is
    responsible for validating that ``project_id`` exists/owned beforehand.
    """
    book = Book(project_id=project_id, title=title, language=language)
    db.add(book)

    for chapter_index, parsed_chapter in enumerate(parsed.chapters):
        chapter = Chapter(
            book=book,
            title=parsed_chapter.title,
            order_index=chapter_index,
        )
        db.add(chapter)
        for scene_index, parsed_scene in enumerate(parsed_chapter.scenes):
            db.add(
                Scene(
                    chapter=chapter,
                    title=parsed_scene.title,
                    content=parsed_scene.content or None,
                    order_index=scene_index,
                    status="draft",
                    word_count=count_words(parsed_scene.content),
                )
            )

    await db.commit()
    await db.refresh(book)
    return book
