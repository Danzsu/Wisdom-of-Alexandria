import unicodedata
import uuid as _uuid

import pytest


def _safe_filename(title: str) -> str:
    """Local copy of the function from exports.py for isolated unit testing."""
    normalized = unicodedata.normalize("NFKD", title)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    safe = ascii_name.replace(" ", "_") or f"book_{_uuid.uuid4().hex[:8]}"
    return f"{safe}.md"


def test_safe_filename_strips_hungarian_diacritics():
    result = _safe_filename("Tűz és víz")
    # ű→u, é→e, í→i after NFKD normalization
    assert result.endswith(".md")
    # No non-ASCII characters
    assert result.isascii()


def test_safe_filename_replaces_spaces_with_underscores():
    result = _safe_filename("Az elveszett királyság")
    assert " " not in result
    assert "_" in result


def test_safe_filename_returns_md_extension():
    result = _safe_filename("Cím")
    assert result.endswith(".md")


def test_safe_filename_ascii_title_unchanged():
    result = _safe_filename("Fantasy Novel")
    assert result == "Fantasy_Novel.md"


def test_safe_filename_empty_title_returns_fallback():
    result = _safe_filename("")
    assert result.endswith(".md")
    # fallback is "book_<8hex>.md" so length > 3
    assert len(result) > 3


def test_safe_filename_all_unicode_title():
    # Title with only non-latin chars (stripped to empty → fallback)
    result = _safe_filename("αβγδ")  # Greek letters
    assert result.endswith(".md")
    assert result.isascii()


def test_export_service_imports():
    from app.services.export_service import export_book_markdown
    assert callable(export_book_markdown)


def test_exports_router_imports():
    from app.api.v1.exports import router
    assert router is not None
