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


def test_project_table_name():
    assert Project.__tablename__ == "projects"


def test_book_table_name():
    assert Book.__tablename__ == "books"


def test_chapter_status_constants():
    assert ChapterStatus.DRAFT == "draft"
    assert ChapterStatus.IN_PROGRESS == "in_progress"
    assert ChapterStatus.COMPLETE == "complete"


def test_scene_status_constants():
    assert SceneStatus.DRAFT == "draft"
    assert SceneStatus.ARCHIVED == "archived"


def test_job_status_constants():
    assert JobStatus.PENDING == "pending"
    assert JobStatus.DONE == "done"
    assert JobStatus.FAILED == "failed"


def test_all_models_have_id_column():
    models = [
        Project,
        Book,
        Chapter,
        Scene,
        Beat,
        Character,
        Location,
        WorldbuildingEntry,
        CodexEntry,
        CodexRelation,
        CodexProgression,
        Snippet,
        StyleGuide,
        GenerationJob,
        Revision,
        AIComment,
    ]
    for model in models:
        assert hasattr(model, "id"), f"{model.__name__} missing id"


def test_all_models_have_timestamps():
    models = [
        Project,
        Book,
        Chapter,
        Scene,
        Beat,
        Character,
        Location,
        WorldbuildingEntry,
        CodexEntry,
        CodexRelation,
        CodexProgression,
        Snippet,
        StyleGuide,
        GenerationJob,
        Revision,
        AIComment,
    ]
    for model in models:
        assert hasattr(model, "created_at"), f"{model.__name__} missing created_at"
        assert hasattr(model, "updated_at"), f"{model.__name__} missing updated_at"


def test_character_has_ai_visible():
    assert hasattr(Character, "ai_visible")


def test_location_has_ai_visible():
    assert hasattr(Location, "ai_visible")


def test_worldbuilding_entry_has_ai_visible():
    assert hasattr(WorldbuildingEntry, "ai_visible")


def test_codex_entry_has_ai_visible():
    assert hasattr(CodexEntry, "ai_visible")
