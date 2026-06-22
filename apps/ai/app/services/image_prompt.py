"""Image-prompt style presets + builders (Phase 1 of AI image generation).

Each style preset (``packages/prompts/hu/image_styles/<slug>.md``) is a detailed
image-prompt template: a STYLE block (lighting / composition / medium / detail
level), a ``---`` separator, then a body template with ``{placeholder}`` tokens.

The builder fills the body tokens from a Codex entry (``CodexEntry`` with an
``entry_type``, ``title``, ``content`` and ``role``) with graceful Hungarian
fallbacks (never leaking a literal ``{token}`` and never injecting the literal
string ``"None"``), then returns

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


def build_codex_prompt(entry, style: str) -> str:
    """Build a full image prompt for a Codex entry in the given style.

    ``entry`` is duck-typed: it must expose ``entry_type`` ("character" |
    "location"), ``title``, ``content`` (a single freeform body) and ``role``.

    The chosen ``style``'s ``entity_type`` must match ``entry.entry_type`` — a
    mismatch (or an unknown style) raises ``ValueError`` listing the valid styles
    for that entry_type. ``CodexEntry`` has only one freeform ``content`` field,
    so that content is mapped into every descriptive token (the STYLE block
    supplies the visual specifics); blank content falls back to a graceful
    Hungarian phrase rather than leaking ``{token}`` or the literal ``"None"``.
    """
    _require_style(style, entry.entry_type)
    content = _clean(entry.content)

    if entry.entry_type == "character":
        appearance = content or "egy ismeretlen megjelenésű alak"
        personality = content or "kiismerhetetlen"
        role = _clean(entry.role)
        role_clause = f", {role}" if role else ""
        return _assemble(
            style,
            name=entry.title,
            appearance=appearance,
            personality=personality,
            role_clause=role_clause,
            extra="",
        )

    # location-type entry
    description = content or "egy meghatározatlan helyszín"
    geography = content or "ismeretlen környezetben"
    atmosphere = content or "meghatározhatatlan hangulat"
    return _assemble(
        style,
        name=entry.title,
        description=description,
        geography=geography,
        atmosphere=atmosphere,
        extra="",
    )


# --- Cover styles (Phase 2) -------------------------------------------------

COVER_STYLES: dict[str, ImageStyle] = {
    "cover_literary": ImageStyle("cover_literary", "Irodalmi", "cover"),
    "cover_fantasy": ImageStyle("cover_fantasy", "Fantasy", "cover"),
    "cover_thriller": ImageStyle("cover_thriller", "Thriller", "cover"),
    "cover_romance": ImageStyle("cover_romance", "Romantikus", "cover"),
    "cover_minimal": ImageStyle("cover_minimal", "Minimalista", "cover"),
}


def _cover_styles_dir() -> Path:
    docker = Path("/app/prompts/hu/cover_styles")
    if docker.exists():
        return docker
    repo_root = Path(__file__).parent.parent.parent.parent.parent
    return repo_root / "packages" / "prompts" / "hu" / "cover_styles"


_cover_loader = PromptLoader(prompts_dir=_cover_styles_dir())


def available_cover_styles() -> list[ImageStyle]:
    """Return the registered cover art-style presets."""
    return list(COVER_STYLES.values())


def build_cover_prompt(book, art_style: str) -> str:
    """Build a cover-art prompt for a Book in the given cover art-style.

    ``book`` is duck-typed: ``title``, ``genre``, ``synopsis``. The art-style must
    be a known cover style (``ValueError`` otherwise). The STYLE block forbids any
    in-art text and requests negative space (typography is composited app-side).
    Blank genre/synopsis fall back to graceful Hungarian phrases — never leaks a
    ``{token}`` or the literal ``"None"``.
    """
    if art_style not in COVER_STYLES:
        names = ", ".join(sorted(COVER_STYLES))
        raise ValueError(f"Unknown cover style {art_style!r}. Valid: {names}.")
    genre = _clean(getattr(book, "genre", None)) or "általános szépirodalom"
    synopsis = _clean(getattr(book, "synopsis", None)) or "egy meg nem nevezett történet"
    style_block = _cover_loader.load_system(art_style)
    body = _cover_loader.load_user(
        art_style, title=book.title, genre=genre, synopsis=synopsis
    )
    return f"{style_block} {body}"
