"""Schemas for the DOCX import endpoint (#2b).

The import creates a whole Book subtree (Book + Chapters + Scenes) in one call;
the response is a compact summary (the new book's id + title + the counts) rather
than the full nested tree — the client navigates to the book and lazy-loads its
chapters/scenes through the existing endpoints.
"""

import uuid

from pydantic import BaseModel


class BookImportSummary(BaseModel):
    """Result of a successful DOCX import: the created book + structure counts."""

    book_id: uuid.UUID
    title: str
    chapter_count: int
    scene_count: int
    word_count: int
