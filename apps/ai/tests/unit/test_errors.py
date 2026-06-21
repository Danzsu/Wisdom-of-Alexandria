"""Unit tests for the AI service's error sanitizer (FIX 1 / FIX 2).

``safe_error`` moved here with the AI service: it is used wherever an internal
exception is surfaced to a client (HTTP detail) or persisted (job
``error_message``), so it must never leak unbounded raw internal text.
"""

import pytest
from alexandria_core.core.errors import safe_error


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
