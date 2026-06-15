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


# ── A5a: bounded error messages ─────────────────────────────────────────────
# A huge reorder with many missing/unknown ids must not produce an unbounded
# error string — at most 10 ids are listed verbatim, then "and N more".


@pytest.mark.unit
def test_validate_permutation_missing_message_is_bounded():
    # 25 current ids, reorder lists only 1 -> 24 missing. The message must list
    # at most 10 ids + an "and N more" suffix, not all 24.
    current = {uuid.uuid4() for _ in range(25)}
    keep = next(iter(current))
    with pytest.raises(ValueError) as excinfo:
        validate_permutation([keep], current, "scene")
    msg = str(excinfo.value)
    assert "missing" in msg
    assert "and 14 more" in msg  # 24 missing - 10 shown = 14
    # Only 10 ids listed verbatim (UUIDs have 4 hyphens each).
    listed = msg.split(":", 1)[1].split(" and ")[0]
    assert listed.count("-") == 10 * 4


@pytest.mark.unit
def test_validate_permutation_unknown_message_is_bounded():
    # An order with 15 unknown ids over a tiny current set.
    a = uuid.uuid4()
    unknowns = [uuid.uuid4() for _ in range(15)]
    with pytest.raises(ValueError) as excinfo:
        validate_permutation([a, *unknowns], {a}, "beat")
    msg = str(excinfo.value)
    assert "unknown" in msg
    assert "and 5 more" in msg  # 15 unknown - 10 shown = 5


@pytest.mark.unit
def test_validate_permutation_small_missing_has_no_more_suffix():
    a, b, c = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    with pytest.raises(ValueError) as excinfo:
        validate_permutation([a], {a, b, c}, "scene")
    msg = str(excinfo.value)
    assert "missing" in msg
    assert "more" not in msg  # only 2 missing -> no truncation suffix
