"""Unit tests for image_prompt: style presets + prompt builders (Phase 1, image gen).

Style presets are detailed image-prompt templates with {placeholder} tokens that
get filled from a Codex Character/Location row. The builders must:
- fill every token (never leak a literal `{...}`),
- never inject the literal string "None",
- substitute graceful Hungarian fallbacks for missing/blank fields,
- validate that the style matches the entity type.
"""

import pytest
from alexandria_core.models.character import Character
from alexandria_core.models.location import Location

from app.services.image_prompt import (
    available_styles,
    build_character_prompt,
    build_location_prompt,
)


@pytest.mark.unit
def test_build_character_prompt_full() -> None:
    c = Character(
        name="Eszter",
        appearance="magas, vörös hajú, zöld szemű",
        personality="határozott és szókimondó",
        role="nyomozó",
    )
    prompt = build_character_prompt(c, "realistic_portrait")
    assert "Eszter" in prompt
    assert "magas, vörös hajú, zöld szemű" in prompt
    assert "határozott és szókimondó" in prompt
    assert "nyomozó" in prompt
    # style block text is present
    assert "Photorealistic" in prompt
    # no leaked template tokens
    assert "{" not in prompt
    assert "}" not in prompt


@pytest.mark.unit
def test_build_character_prompt_graceful_empties() -> None:
    c = Character(name="Névtelen", appearance=None, personality=None, role=None)
    prompt = build_character_prompt(c, "realistic_portrait")
    assert "Névtelen" in prompt
    assert "egy ismeretlen megjelenésű alak" in prompt
    assert "kiismerhetetlen" in prompt
    assert "None" not in prompt
    assert "{" not in prompt
    assert "}" not in prompt


@pytest.mark.unit
def test_build_character_prompt_unknown_style() -> None:
    c = Character(name="X")
    with pytest.raises(ValueError) as exc:
        build_character_prompt(c, "does_not_exist")
    msg = str(exc.value)
    # the message lists valid character styles
    assert "realistic_portrait" in msg
    assert "anime" in msg


@pytest.mark.unit
def test_build_character_prompt_rejects_location_style() -> None:
    c = Character(name="X")
    with pytest.raises(ValueError):
        build_character_prompt(c, "epic_landscape")


@pytest.mark.unit
def test_build_location_prompt_full() -> None:
    loc = Location(
        name="Alexandriai könyvtár",
        description="hatalmas márvány csarnok tekercsekkel",
        geography="a tengerparton, dombokkal körülvéve",
        atmosphere="poros, ünnepélyes csend",
    )
    prompt = build_location_prompt(loc, "watercolor_location")
    assert "Alexandriai könyvtár" in prompt
    assert "hatalmas márvány csarnok tekercsekkel" in prompt
    assert "a tengerparton, dombokkal körülvéve" in prompt
    assert "poros, ünnepélyes csend" in prompt
    assert "{" not in prompt
    assert "}" not in prompt


@pytest.mark.unit
def test_build_location_prompt_graceful_empties() -> None:
    loc = Location(name="Ismeretlen hely", description=None, geography=None, atmosphere=None)
    prompt = build_location_prompt(loc, "epic_landscape")
    assert "Ismeretlen hely" in prompt
    assert "egy meghatározatlan helyszín" in prompt
    assert "None" not in prompt
    assert "{" not in prompt
    assert "}" not in prompt


@pytest.mark.unit
def test_build_location_prompt_rejects_character_style() -> None:
    loc = Location(name="X")
    with pytest.raises(ValueError):
        build_location_prompt(loc, "realistic_portrait")


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
