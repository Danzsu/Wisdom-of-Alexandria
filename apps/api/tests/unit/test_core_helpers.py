"""Unit tests for the shared audit-fix helpers.

Covers FIX 1/2 (safe_error sanitization), FIX 5 (reorder permutation
validation), and FIX 6 (markup-aware word counting).
"""

import uuid

import pytest

from app.core.errors import safe_error
from app.core.text import count_words
from app.services.ordering import validate_permutation

# ── safe_error (FIX 1 / FIX 2) ──────────────────────────────────────────────


@pytest.mark.unit
def test_safe_error_strips_newlines():
    out = safe_error(Exception("line one\nline two\r\nline three"))
    assert "\n" not in out
    assert "\r" not in out
    assert out == "line one line two line three"


@pytest.mark.unit
def test_safe_error_truncates_long_text():
    out = safe_error(Exception("x" * 5000))
    assert len(out) <= 300


@pytest.mark.unit
def test_safe_error_falls_back_to_class_name_when_empty():
    out = safe_error(ValueError(""))
    assert out == "ValueError"


@pytest.mark.unit
def test_safe_error_accepts_plain_string():
    out = safe_error("boom\nsecond line")
    assert out == "boom second line"


@pytest.mark.unit
def test_safe_error_collapses_tabs_and_runs():
    out = safe_error(Exception("a\t\t b   c"))
    assert out == "a b c"


# ── count_words (FIX 6) ─────────────────────────────────────────────────────


@pytest.mark.unit
def test_count_words_strips_markup():
    assert count_words("<p>egy két</p>") == 2


@pytest.mark.unit
def test_count_words_plain_text():
    assert count_words("egy két három") == 3


@pytest.mark.unit
def test_count_words_none_is_zero():
    assert count_words(None) == 0


@pytest.mark.unit
def test_count_words_empty_is_zero():
    assert count_words("") == 0
    assert count_words("   ") == 0


@pytest.mark.unit
def test_count_words_tags_do_not_merge_tokens():
    # Without replacing tags with a space, this would collapse to 1 token.
    assert count_words("<p>a</p><p>b</p>") == 2


@pytest.mark.unit
def test_count_words_nested_formatting():
    assert count_words("<p>A <strong>hős</strong> belép.</p>") == 3


# ── validate_permutation (FIX 5) ────────────────────────────────────────────


@pytest.mark.unit
def test_validate_permutation_accepts_exact_permutation():
    a, b, c = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    # No exception means valid.
    validate_permutation([c, a, b], {a, b, c}, "scene")


@pytest.mark.unit
def test_validate_permutation_rejects_unknown_id():
    a, b = uuid.uuid4(), uuid.uuid4()
    with pytest.raises(ValueError, match="unknown"):
        validate_permutation([a, b], {a}, "scene")


@pytest.mark.unit
def test_validate_permutation_rejects_missing_id():
    a, b = uuid.uuid4(), uuid.uuid4()
    with pytest.raises(ValueError, match="missing"):
        validate_permutation([a], {a, b}, "beat")


@pytest.mark.unit
def test_validate_permutation_rejects_duplicates():
    a, b = uuid.uuid4(), uuid.uuid4()
    with pytest.raises(ValueError, match="duplicate"):
        validate_permutation([a, a], {a, b}, "chapter")
