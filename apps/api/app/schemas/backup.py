"""Schemas for the project JSON backup/restore endpoints (Feature #5).

Restore accepts a multipart ``.json`` file upload (mirroring the DOCX import
contract) and returns a compact summary: the freshly-created project's id +
title + per-collection counts, rather than echoing the whole nested graph back.
"""

import uuid

from pydantic import BaseModel


class RestoreSummary(BaseModel):
    """Result of a successful restore: the new project + restored-entity counts.

    ``project_id`` is a FRESH id (a restore creates a copy, never a move).
    """

    project_id: uuid.UUID
    title: str
    series_count: int
    book_count: int
    chapter_count: int
    scene_count: int
    beat_count: int
    codex_entry_count: int
    character_count: int
    location_count: int
    worldbuilding_count: int
    snippet_count: int
    style_guide_count: int
    codex_relation_count: int
    codex_progression_count: int
