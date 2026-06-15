import pytest
from alexandria_core.models import (
    AIComment,
    Beat,
    Book,
    Chapter,
    ChapterStatus,
    Character,
    CodexEntry,
    CodexProgression,
    CodexRelation,
    GenerationJob,
    JobStatus,
    Location,
    Project,
    Revision,
    Scene,
    SceneStatus,
    Snippet,
    StyleGuide,
    WorldbuildingEntry,
)


def test_chapter_table_name():
    assert Chapter.__tablename__ == "chapters"


def test_scene_table_name():
    assert Scene.__tablename__ == "scenes"


def test_worldbuilding_entry_table_name():
    assert WorldbuildingEntry.__tablename__ == "worldbuilding_entries"


def test_snippet_table_name():
    assert Snippet.__tablename__ == "snippets"


def test_style_guide_table_name():
    assert StyleGuide.__tablename__ == "style_guides"


def test_ai_comment_table_name():
    assert AIComment.__tablename__ == "ai_comments"


def test_generation_job_table_name():
    assert GenerationJob.__tablename__ == "generation_jobs"


def test_revision_table_name():
    assert Revision.__tablename__ == "revisions"


def test_scene_has_word_count_column():
    assert hasattr(Scene, "word_count")


def test_character_has_aliases_column():
    assert hasattr(Character, "aliases")
