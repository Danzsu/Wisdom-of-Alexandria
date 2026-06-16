"""Unit tests for the pure manuscript Markdown parser (#2b).

No pandoc, no DB — these pin the deterministic heuristic + its edge cases
(multi-chapter H1, H2 / horizontal-rule scene splits, no-H2 single scene, no
headings at all, single-line vs multi-line preamble, whitespace normalization).
"""

import pytest

from app.core.text import count_words
from app.services.import_service import (
    ParsedBook,
    parse_manuscript_markdown,
)

pytestmark = pytest.mark.unit


def _parse(md: str) -> ParsedBook:
    return parse_manuscript_markdown(md, default_book_title="Fallback")


def test_multi_chapter_with_h2_scene_splits():
    md = (
        "# Első fejezet\n"
        "\n"
        "## A kezdet\n"
        "Az első jelenet szövege.\n"
        "\n"
        "## A folytatás\n"
        "A második jelenet.\n"
        "\n"
        "# Második fejezet\n"
        "\n"
        "Egyetlen jelenet itt.\n"
    )
    book = _parse(md)

    assert [c.title for c in book.chapters] == ["Első fejezet", "Második fejezet"]
    ch1 = book.chapters[0]
    assert [s.title for s in ch1.scenes] == ["A kezdet", "A folytatás"]
    assert ch1.scenes[0].content == "Az első jelenet szövege."
    assert ch1.scenes[1].content == "A második jelenet."

    ch2 = book.chapters[1]
    # No H2 → one generated scene title.
    assert [s.title for s in ch2.scenes] == ["1. jelenet"]
    assert ch2.scenes[0].content == "Egyetlen jelenet itt."


def test_chapter_with_no_h2_is_one_scene():
    md = "# Csak egy fejezet\n\nElső bekezdés.\n\nMásodik bekezdés.\n"
    book = _parse(md)

    assert len(book.chapters) == 1
    scenes = book.chapters[0].scenes
    assert len(scenes) == 1
    assert scenes[0].title == "1. jelenet"
    # Interior blank line between paragraphs is preserved.
    assert scenes[0].content == "Első bekezdés.\n\nMásodik bekezdés."


def test_no_headings_at_all_single_chapter_single_scene():
    md = "Csak sima próza, semmi cím.\n\nMég egy bekezdés.\n"
    book = _parse(md)

    assert book.title is None
    assert len(book.chapters) == 1
    assert book.chapters[0].title == "1. fejezet"
    assert len(book.chapters[0].scenes) == 1
    assert (
        book.chapters[0].scenes[0].content
        == "Csak sima próza, semmi cím.\n\nMég egy bekezdés."
    )


def test_single_line_preamble_becomes_book_title():
    md = "A nagy regény\n\n# Első fejezet\n\nSzöveg.\n"
    book = _parse(md)

    assert book.title == "A nagy regény"
    # The title line is NOT also emitted as a chapter.
    assert [c.title for c in book.chapters] == ["Első fejezet"]


def test_multi_line_preamble_becomes_bevezeto_chapter():
    md = (
        "Első sor próza.\n"
        "Második sor próza.\n"
        "\n"
        "# Első fejezet\n"
        "\n"
        "Fejezet szöveg.\n"
    )
    book = _parse(md)

    assert book.title is None
    assert [c.title for c in book.chapters] == ["Bevezető", "Első fejezet"]
    assert book.chapters[0].scenes[0].content == (
        "Első sor próza.\nMásodik sor próza."
    )


def test_horizontal_rule_splits_scenes():
    for rule in ("---", "***", "* * *", "___"):
        md = f"# Fejezet\n\nElső jelenet.\n\n{rule}\n\nMásodik jelenet.\n"
        book = _parse(md)
        scenes = book.chapters[0].scenes
        assert len(scenes) == 2, f"rule {rule!r} did not split"
        assert scenes[0].content == "Első jelenet."
        assert scenes[1].content == "Második jelenet."
        # Rule-split scenes get generated titles.
        assert [s.title for s in scenes] == ["1. jelenet", "2. jelenet"]


def test_h2_and_rule_mixed_in_one_chapter():
    md = (
        "# Fejezet\n"
        "\n"
        "## Címzett jelenet\n"
        "A.\n"
        "\n"
        "---\n"
        "\n"
        "B.\n"
    )
    book = _parse(md)
    scenes = book.chapters[0].scenes
    assert [s.title for s in scenes] == ["Címzett jelenet", "2. jelenet"]
    assert scenes[0].content == "A."
    assert scenes[1].content == "B."


def test_empty_and_whitespace_yield_no_chapters():
    assert _parse("").chapters == []
    assert _parse("   \n\n  \t \n").chapters == []
    assert _parse("").title is None


def test_crlf_line_endings_normalized():
    md = "# Fejezet\r\n\r\nSzöveg sor.\r\n"
    book = _parse(md)
    assert book.chapters[0].scenes[0].content == "Szöveg sor."


def test_word_count_matches_count_words_helper():
    md = "# Fejezet\n\nEgy két három négy öt.\n"
    book = _parse(md)
    content = book.chapters[0].scenes[0].content
    # The create path uses count_words on exactly this content.
    assert count_words(content) == 5


def test_long_heading_is_truncated_to_255():
    long_title = "A" * 400
    md = f"# {long_title}\n\nszöveg\n"
    book = _parse(md)
    assert len(book.chapters[0].title) == 255


def test_chapter_with_only_blank_body_still_has_one_scene():
    md = "# Üres fejezet\n\n\n# Másik\n\nvalami\n"
    book = _parse(md)
    assert book.chapters[0].title == "Üres fejezet"
    assert len(book.chapters[0].scenes) == 1
    assert book.chapters[0].scenes[0].content == ""
    assert book.chapters[0].scenes[0].title == "1. jelenet"
