"""Unit tests for image_prompt: style presets + prompt builder (Phase 1, image gen).

Style presets are detailed image-prompt templates with {placeholder} tokens that
get filled from a Codex entry (``CodexEntry`` with ``entry_type``, ``title``,
``content``, ``role``). The builder must:
- fill every token (never leak a literal `{...}`),
- never inject the literal string "None",
- substitute graceful Hungarian fallbacks for missing/blank fields,
- validate that the style matches the entry's entry_type.
"""

import pytest
from alexandria_core.models.codex_entry import CodexEntry

from app.services.image_prompt import available_styles, build_codex_prompt


@pytest.mark.unit
def test_build_codex_prompt_character_full() -> None:
    entry = CodexEntry(
        entry_type="character",
        title="Szelene",
        content="magas, vörös hajú, zöld szemű, határozott és szókimondó",
        role="írnok",
    )
    prompt = build_codex_prompt(entry, "realistic_portrait")
    assert "Szelene" in prompt
    assert "magas, vörös hajú, zöld szemű, határozott és szókimondó" in prompt
    assert "írnok" in prompt
    # style block text is present
    assert "Photorealistic" in prompt
    # no leaked template tokens
    assert "{" not in prompt
    assert "}" not in prompt


@pytest.mark.unit
def test_build_codex_prompt_character_graceful_empties() -> None:
    entry = CodexEntry(entry_type="character", title="Névtelen", content=None, role=None)
    prompt = build_codex_prompt(entry, "realistic_portrait")
    assert "Névtelen" in prompt
    assert "egy ismeretlen megjelenésű alak" in prompt
    assert "None" not in prompt
    assert "{" not in prompt
    assert "}" not in prompt


@pytest.mark.unit
def test_build_codex_prompt_unknown_style() -> None:
    entry = CodexEntry(entry_type="character", title="X")
    with pytest.raises(ValueError) as exc:
        build_codex_prompt(entry, "does_not_exist")
    msg = str(exc.value)
    # the message lists valid character styles
    assert "realistic_portrait" in msg
    assert "anime" in msg


@pytest.mark.unit
def test_build_codex_prompt_rejects_mismatched_entity_type() -> None:
    # A character style on a location entry → ValueError (entity_type mismatch).
    entry = CodexEntry(entry_type="location", title="X")
    with pytest.raises(ValueError):
        build_codex_prompt(entry, "realistic_portrait")


@pytest.mark.unit
def test_build_codex_prompt_location_full() -> None:
    entry = CodexEntry(
        entry_type="location",
        title="Alexandriai könyvtár",
        content="hatalmas márvány csarnok tekercsekkel, a tengerparton, poros csend",
    )
    prompt = build_codex_prompt(entry, "watercolor_location")
    assert "Alexandriai könyvtár" in prompt
    assert "hatalmas márvány csarnok tekercsekkel, a tengerparton, poros csend" in prompt
    # style block text is present
    assert "watercolour" in prompt
    assert "{" not in prompt
    assert "}" not in prompt


@pytest.mark.unit
def test_build_codex_prompt_location_graceful_empties() -> None:
    entry = CodexEntry(entry_type="location", title="Ismeretlen hely", content=None)
    prompt = build_codex_prompt(entry, "epic_landscape")
    assert "Ismeretlen hely" in prompt
    assert "egy meghatározatlan helyszín" in prompt
    assert "None" not in prompt
    assert "{" not in prompt
    assert "}" not in prompt


@pytest.mark.unit
def test_build_codex_prompt_rejects_location_style_on_character() -> None:
    entry = CodexEntry(entry_type="character", title="X")
    with pytest.raises(ValueError):
        build_codex_prompt(entry, "epic_landscape")


@pytest.mark.unit
def test_available_styles_character() -> None:
    styles = available_styles("character")
    assert all(s.entity_type == "character" for s in styles)
    slugs = {s.slug for s in styles}
    assert "realistic_portrait" in slugs
    assert "painterly_fantasy" in slugs
    assert "anime" in slugs
    assert "noir_portrait" in slugs
    # no location styles leak in
    assert "watercolor_location" not in slugs
    assert "epic_landscape" not in slugs
    # labels are human-readable Hungarian strings
    assert all(s.label and isinstance(s.label, str) for s in styles)


@pytest.mark.unit
def test_available_styles_location() -> None:
    styles = available_styles("location")
    assert all(s.entity_type == "location" for s in styles)
    slugs = {s.slug for s in styles}
    assert "watercolor_location" in slugs
    assert "epic_landscape" in slugs
    assert "realistic_portrait" not in slugs


# ---------------------------------------------------------------------------
# Task 3: Cover art-style presets + build_cover_prompt
# ---------------------------------------------------------------------------

from types import SimpleNamespace

from app.services import image_prompt


def _book(**kw):
    base = {"title": "A Fárosz árnyéka", "genre": "fantasy", "synopsis": "Egy könyvtáros titka."}
    base.update(kw)
    return SimpleNamespace(**base)


def test_available_cover_styles_nonempty():
    slugs = {s.slug for s in image_prompt.available_cover_styles()}
    assert {"cover_literary", "cover_fantasy", "cover_minimal"} <= slugs
    assert all(s.entity_type == "cover" for s in image_prompt.available_cover_styles())


def test_build_cover_prompt_fills_tokens_and_forbids_text():
    prompt = image_prompt.build_cover_prompt(_book(), "cover_fantasy")
    assert "A Fárosz árnyéka" in prompt          # {title}
    assert "fantasy" in prompt                    # {genre}
    assert "Egy könyvtáros titka." in prompt      # {synopsis}
    # The STYLE block must forbid in-art text (we composite typography ourselves).
    low = prompt.lower()
    assert "no text" in low and ("negative space" in low or "space for" in low)


def test_build_cover_prompt_blank_fields_fall_back():
    prompt = image_prompt.build_cover_prompt(_book(genre=None, synopsis="  "), "cover_minimal")
    assert "{" not in prompt and "None" not in prompt


def test_build_cover_prompt_unknown_style_raises():
    import pytest
    with pytest.raises(ValueError):
        image_prompt.build_cover_prompt(_book(), "realistic_portrait")  # a character style
