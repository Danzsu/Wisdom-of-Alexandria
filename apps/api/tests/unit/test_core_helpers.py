"""Unit tests for the shared domain helpers.

Covers FIX 5 (reorder permutation validation) and FIX 6 (markup-aware word
counting). The ``safe_error`` sanitizer moved with the AI service to
``apps/ai`` (it is only used by AI code) and is tested there.
"""

import uuid

import pytest

from app.core.text import count_words
from app.services.ordering import validate_permutation

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
