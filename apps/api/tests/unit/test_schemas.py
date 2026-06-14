import uuid
import pytest
from pydantic import ValidationError

from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectRead
from app.schemas.book import BookCreate, BookUpdate
from app.schemas.chapter import ChapterCreate
from app.schemas.scene import SceneCreate
from app.schemas.beat import BeatCreate
from app.schemas.character import CharacterCreate, CharacterUpdate
from app.schemas.codex_entry import CodexEntryCreate
from app.schemas.snippet import SnippetCreate
from app.schemas.style_guide import StyleGuideCreate


# ProjectCreate
def test_project_create_requires_title():
    with pytest.raises(ValidationError):
        ProjectCreate(title="")  # min_length=1


def test_project_create_title_too_long():
    with pytest.raises(ValidationError):
        ProjectCreate(title="x" * 256)  # max_length=255


def test_project_create_default_language():
    p = ProjectCreate(title="Teszt")
    assert p.language == "hu"


def test_project_update_all_optional():
    # Should not raise — all fields optional
    u = ProjectUpdate()
    assert u.title is None
    assert u.description is None
    assert u.language is None


# BookCreate
def test_book_create_default_order_index():
    b = BookCreate(title="Könyv")
    assert b.order_index == 0


def test_book_create_word_count_target_optional():
    b = BookCreate(title="Könyv")
    assert b.word_count_target is None


def test_book_create_default_language():
    b = BookCreate(title="Könyv")
    assert b.language == "hu"


# ChapterCreate
def test_chapter_create_default_status():
    c = ChapterCreate(title="Fejezet")
    assert c.status == "draft"


def test_chapter_create_default_order_index():
    c = ChapterCreate(title="Fejezet")
    assert c.order_index == 0


# SceneCreate
def test_scene_create_pov_character_id_optional():
    s = SceneCreate(title="Jelenet")
    assert s.pov_character_id is None


def test_scene_create_content_optional():
    s = SceneCreate(title="Jelenet")
    assert s.content is None


# BeatCreate
def test_beat_create_requires_description():
    with pytest.raises(ValidationError):
        BeatCreate(description="")  # min_length=1


def test_beat_create_beat_type_optional():
    b = BeatCreate(description="Esemény")
    assert b.beat_type is None


# CharacterCreate
def test_character_create_aliases_defaults_to_empty_list():
    c = CharacterCreate(name="Aragorn")
    assert c.aliases == []


def test_character_create_ai_visible_defaults_true():
    c = CharacterCreate(name="Aragorn")
    assert c.ai_visible is True


def test_character_update_all_optional():
    u = CharacterUpdate()
    assert u.name is None
    assert u.ai_visible is None


# CodexEntryCreate
def test_codex_entry_tags_defaults_to_empty_list():
    c = CodexEntryCreate(title="Varázslat")
    assert c.tags == []


# SnippetCreate
def test_snippet_create_tags_defaults_to_empty_list():
    s = SnippetCreate(title="Idézet", content="Szöveg")
    assert s.tags == []
