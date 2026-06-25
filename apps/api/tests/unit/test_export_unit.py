from app.api.v1.exports import _safe_filename


def test_safe_filename_strips_hungarian_diacritics():
    # ű→u, é→e, í→i after NFKD normalization
    result = _safe_filename("Tűz és víz", "md")
    assert result == "Tuz_es_viz.md"
    assert result.isascii()


def test_safe_filename_replaces_spaces_with_underscores():
    result = _safe_filename("Az elveszett királyság", "md")
    assert result == "Az_elveszett_kiralysag.md"
    assert " " not in result


def test_safe_filename_ascii_title_unchanged():
    assert _safe_filename("Fantasy Novel", "md") == "Fantasy_Novel.md"


def test_safe_filename_empty_title_returns_fallback():
    result = _safe_filename("", "md")
    # fallback is "book_<8hex>.md"
    assert result.startswith("book_")
    assert result.endswith(".md")
    assert len(result) == len("book_") + 8 + len(".md")


def test_safe_filename_all_unicode_title_returns_fallback():
    # Title with only non-latin chars → stripped to empty → fallback
    result = _safe_filename("αβγδ", "md")  # Greek letters
    assert result.startswith("book_")
    assert result.endswith(".md")
    assert result.isascii()


def test_safe_filename_non_ascii_chars_without_ascii_form_are_dropped():
    # Characters with no ASCII decomposition (emoji, non-latin scripts) are
    # removed by the ascii-encode step, so they can never reach the filename.
    result = _safe_filename("a\U0001F600b", "md")  # 'a' + grinning-face + 'b'
    assert result == "ab.md"
    assert result.isascii()


def test_safe_filename_extension_is_always_the_passed_extension():
    # The extension is supplied by the caller, never inferred from the title —
    # a title containing a dot must not change the produced extension.
    assert _safe_filename("my.book", "docx") == "my.book.docx"


def test_safe_filename_applies_each_extension():
    for ext in ("md", "docx", "epub", "pdf"):
        assert _safe_filename("Konyv", ext) == f"Konyv.{ext}"


def test_export_service_export_book_markdown_is_callable():
    # Behavioral-ish: the production export entrypoint exists and is callable.
    from app.services.export_service import export_book_markdown

    assert callable(export_book_markdown)
    assert export_book_markdown.__name__ == "export_book_markdown"


def test_exports_router_has_export_route():
    from app.api.v1.exports import router

    paths = {route.path for route in router.routes}
    assert "/books/{book_id}/exports" in paths
