"""Cover typography compositor (Phase 2).

Takes generated background art and an ebook-cover layout, crops to the exact KDP
ebook size (1600x2560 / 1:1.6) and draws the title/author/optional subtitle with
bundled OFL fonts (Pillow ImageDraw). Diffusion models render text poorly, so the
art is generated text-free (see build_cover_prompt) and typography is composited
here — deterministically, per layout.
"""
from __future__ import annotations

import io
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

COVER_W = 1600
COVER_H = 2560
_MARGIN = 120  # side margin in px

_FONTS_DIR = Path(__file__).resolve().parent.parent.parent / "fonts"


@dataclass(frozen=True)
class CoverLayout:
    slug: str
    label: str
    title_font: str          # ttf filename in _FONTS_DIR
    author_font: str
    anchor: str              # "top" | "center" | "bottom"
    title_color: tuple[int, int, int]
    scrim: bool              # darken the text band for legibility


LAYOUTS: dict[str, CoverLayout] = {
    "classic_centered": CoverLayout(
        "classic_centered", "Klasszikus, középre",
        "Literata-Bold.ttf", "Inter-Medium.ttf", "center", (245, 242, 236), False),
    "bottom_scrim": CoverLayout(
        "bottom_scrim", "Alsó sávban",
        "Literata-Bold.ttf", "Inter-Medium.ttf", "bottom", (255, 255, 255), True),
    "top_minimal": CoverLayout(
        "top_minimal", "Felül, minimál",
        "Inter-Bold.ttf", "Inter-Regular.ttf", "top", (255, 255, 255), True),
}


def available_cover_layouts() -> list[CoverLayout]:
    return list(LAYOUTS.values())


def _require_layout(layout: str) -> CoverLayout:
    if layout not in LAYOUTS:
        names = ", ".join(sorted(LAYOUTS))
        raise ValueError(f"Unknown cover layout {layout!r}. Valid: {names}.")
    return LAYOUTS[layout]


def _font(filename: str, size: int) -> ImageFont.FreeTypeFont:
    path = _FONTS_DIR / filename
    if not path.exists():
        raise ValueError(f"cover font missing: {path}")
    return ImageFont.truetype(str(path), size)


def _cover_crop(img: Image.Image, w: int, h: int) -> Image.Image:
    """Scale to cover the target box, then center-crop to exactly (w, h)."""
    scale = max(w / img.width, h / img.height)
    resized = img.resize((round(img.width * scale), round(img.height * scale)))
    left = (resized.width - w) // 2
    top = (resized.height - h) // 2
    return resized.crop((left, top, left + w, top + h))


def _wrap(draw, text: str, font, max_w: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for word in words:
        trial = f"{cur} {word}".strip()
        if not cur or draw.textlength(trial, font=font) <= max_w:
            cur = trial
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines or [text]


def _fit(draw, text: str, font_file: str, max_w: int, max_size: int, min_size: int = 28):
    size = max_size
    while size >= min_size:
        font = _font(font_file, size)
        lines = _wrap(draw, text, font, max_w)
        if all(draw.textlength(ln, font=font) <= max_w for ln in lines):
            return font, lines
        size -= 4
    font = _font(font_file, min_size)
    return font, _wrap(draw, text, font, max_w)


def _apply_scrim(canvas: Image.Image, anchor: str) -> None:
    """Darken a vertical band behind the text for legibility."""
    # Use the canvas's own size (not the module constants) so the scrim is
    # correct even if this is ever called on a differently-sized canvas.
    w, h = canvas.size
    overlay = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    band = h // 2
    if anchor == "top":
        od.rectangle((0, 0, w, band), fill=(0, 0, 0, 130))
    elif anchor == "bottom":
        od.rectangle((0, h - band, w, h), fill=(0, 0, 0, 150))
    else:  # center
        od.rectangle((0, h // 3, w, h * 2 // 3), fill=(0, 0, 0, 110))
    canvas.paste(Image.alpha_composite(canvas.convert("RGBA"), overlay).convert("RGB"), (0, 0))


def compose_cover(
    background_png: bytes,
    *,
    layout: str,
    title: str,
    author: str,
    subtitle: str | None = None,
) -> bytes:
    """Composite typography onto the background; return a 1600x2560 PNG.

    Draws the title (wrapped + autofit), the author below it, and an optional
    subtitle (wrapped, smaller) below the author — all centered in the layout's
    anchor band."""
    spec = _require_layout(layout)
    with Image.open(io.BytesIO(background_png)) as bg:
        bg.load()
        canvas = _cover_crop(bg.convert("RGB"), COVER_W, COVER_H)

    if spec.scrim:
        _apply_scrim(canvas, spec.anchor)

    draw = ImageDraw.Draw(canvas)
    max_w = COVER_W - 2 * _MARGIN
    title_font, title_lines = _fit(draw, title, spec.title_font, max_w, max_size=150)
    author_font = _font(spec.author_font, 64)
    subtitle = (subtitle or "").strip()
    subtitle_font, subtitle_lines = (
        _fit(draw, subtitle, spec.author_font, max_w, max_size=56, min_size=28)
        if subtitle
        else (None, [])
    )

    def _lines_h(lines, font, gap: int) -> int:
        return sum(draw.textbbox((0, 0), ln, font=font)[3] + gap for ln in lines)

    title_h = _lines_h(title_lines, title_font, 12)
    author_h = draw.textbbox((0, 0), author, font=author_font)[3] if author else 0
    subtitle_h = _lines_h(subtitle_lines, subtitle_font, 8) if subtitle else 0
    block_h = (
        title_h
        + (author_h + 40 if author else 0)
        + (subtitle_h + 24 if subtitle else 0)
    )

    if spec.anchor == "top":
        y = _MARGIN + 40
    elif spec.anchor == "bottom":
        y = COVER_H - _MARGIN - block_h
    else:
        y = (COVER_H - block_h) // 2

    for ln in title_lines:
        w = draw.textlength(ln, font=title_font)
        draw.text(((COVER_W - w) / 2, y), ln, font=title_font, fill=spec.title_color)
        y += draw.textbbox((0, 0), ln, font=title_font)[3] + 12

    if author:
        y += 28
        w = draw.textlength(author, font=author_font)
        draw.text(((COVER_W - w) / 2, y), author, font=author_font, fill=spec.title_color)
        y += author_h

    if subtitle:
        y += 24
        for ln in subtitle_lines:
            w = draw.textlength(ln, font=subtitle_font)
            draw.text(
                ((COVER_W - w) / 2, y), ln, font=subtitle_font, fill=spec.title_color
            )
            y += draw.textbbox((0, 0), ln, font=subtitle_font)[3] + 8

    out = io.BytesIO()
    canvas.save(out, "PNG")
    return out.getvalue()
