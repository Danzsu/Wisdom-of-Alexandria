"""Image-prompt style presets + builders (Phase 1 of AI image generation).

Each style preset (``packages/prompts/hu/image_styles/<slug>.md``) is a detailed
image-prompt template: a STYLE block (lighting / composition / medium / detail
level), a ``---`` separator, then a body template with ``{placeholder}`` tokens.

The builders fill the body tokens from a Codex Character/Location row with
graceful Hungarian fallbacks (never leaking a literal ``{token}`` and never
injecting the literal string ``"None"``), then return

    STYLE block + " " + filled body

ready to feed ``ModelRouter.generate_image``.
"""

from dataclasses import dataclass
from pathlib import Path

from app.services.prompt_loader import PromptLoader


@dataclass(frozen=True)
class ImageStyle:
    """A canned image-prompt style preset."""

    slug: str
    label: str
    entity_type: str  # "character" | "location"


# Registry of every available style. The slug matches the preset .md filename.
STYLES: dict[str, ImageStyle] = {
    "realistic_portrait": ImageStyle(
        "realistic_portrait", "Fotorealisztikus portré", "character"
    ),
    "painterly_fantasy": ImageStyle(
        "painterly_fantasy", "Festett fantasy illusztráció", "character"
    ),
    "anime": ImageStyle("anime", "Anime / manga", "character"),
    "noir_portrait": ImageStyle("noir_portrait", "Fekete-fehér noir portré", "character"),
    "watercolor_location": ImageStyle(
        "watercolor_location", "Akvarell helyszín", "location"
    ),
    "epic_landscape": ImageStyle("epic_landscape", "Epikus tájkép", "location"),
}


def _styles_dir() -> Path:
    """Resolve the image_styles prompt dir, mirroring PromptLoader's resolution.

    Docker mounts packages/prompts at /app/prompts; locally, 5 parents from this
    file (apps/ai/app/services/image_prompt.py) lands on the repo root.
    """
    docker = Path("/app/prompts/hu/image_styles")
    if docker.exists():
        return docker
    repo_root = Path(__file__).parent.parent.parent.parent.parent
    return repo_root / "packages" / "prompts" / "hu" / "image_styles"


_loader = PromptLoader(prompts_dir=_styles_dir())


def available_styles(entity_type: str) -> list[ImageStyle]:
    """Return the registered styles for the given entity type."""
    return [s for s in STYLES.values() if s.entity_type == entity_type]


def _require_style(style: str, entity_type: str) -> ImageStyle:
    """Validate ``style`` is a known style for ``entity_type``, else raise."""
    valid = available_styles(entity_type)
    valid_slugs = {s.slug for s in valid}
    if style not in valid_slugs:
        names = ", ".join(sorted(valid_slugs))
        raise ValueError(
            f"Unknown {entity_type} image style {style!r}. "
            f"Valid {entity_type} styles: {names}."
        )
    return STYLES[style]


def _clean(value: str | None) -> str | None:
    """Return a non-blank stripped string, or None for missing/blank values."""
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _assemble(style: str, **tokens: str) -> str:
    """Load the preset and return ``STYLE block + " " + filled body``."""
    style_block = _loader.load_system(style)
    body = _loader.load_user(style, **tokens)
    return f"{style_block} {body}"


def build_character_prompt(character, style: str) -> str:
    """Build a full image prompt for a Character row in the given style."""
    _require_style(style, "character")

    appearance = _clean(character.appearance) or "egy ismeretlen megjelenésű alak"
    personality = _clean(character.personality) or "kiismerhetetlen"
    role = _clean(character.role)
    role_clause = f", {role}" if role else ""

    return _assemble(
        style,
        name=character.name,
        appearance=appearance,
        personality=personality,
        role_clause=role_clause,
        extra="",
    )


def build_location_prompt(location, style: str) -> str:
    """Build a full image prompt for a Location row in the given style."""
    _require_style(style, "location")

    description = _clean(location.description) or "egy meghatározatlan helyszín"
    geography = _clean(location.geography) or "ismeretlen környezetben"
    atmosphere = _clean(location.atmosphere) or "meghatározhatatlan hangulat"

    return _assemble(
        style,
        name=location.name,
        description=description,
        geography=geography,
        atmosphere=atmosphere,
        extra="",
    )
