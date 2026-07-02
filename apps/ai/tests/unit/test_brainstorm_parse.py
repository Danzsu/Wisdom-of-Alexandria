"""Brainstorm response parsing (_parse_ideas) — tiered, mirroring _parse_continuity.

Tier 1: the whole response is a JSON array (of strings, or objects carrying an
        "idea"/"text" string) — or a JSON object wrapping the array under "ideas".
Tier 2: the first [...] block extracted from prose / a ```json fence.
Tier 3: plain-line fallback — non-empty lines with bullet/number markers stripped.
Unusable (whitespace-only) → None; the CALLER degrades to a single visible
fallback idea (pinned in the integration tests), never a crash.
"""

import pytest

from app.services.ai_service import _parse_ideas

# ── tier 1: pure JSON ────────────────────────────────────────────────────────


def test_parse_json_array_of_strings():
    assert _parse_ideas('["Első ötlet", "Második ötlet"]') == [
        "Első ötlet",
        "Második ötlet",
    ]


def test_parse_json_array_coerces_objects_and_drops_junk():
    """Objects with an "idea"/"text" string are accepted; non-strings and empty
    strings are dropped — a junk item never becomes an idea."""
    raw = '[{"idea": "A"}, {"text": "B"}, 42, "", "  ", null, "C"]'
    assert _parse_ideas(raw) == ["A", "B", "C"]


def test_parse_json_object_with_ideas_key():
    assert _parse_ideas('{"ideas": ["A", "B"]}') == ["A", "B"]


# ── tier 2: array embedded in prose / fence ──────────────────────────────────


def test_parse_json_array_inside_code_fence():
    raw = 'Íme az ötletek:\n```json\n["A", "B"]\n```\nRemélem tetszik.'
    assert _parse_ideas(raw) == ["A", "B"]


# ── tier 3: plain-line fallback ──────────────────────────────────────────────


def test_parse_plain_lines_strips_bullets_and_numbers():
    raw = "- Első ötlet\n* Második ötlet\n\n3. Harmadik ötlet\n4) Negyedik ötlet"
    assert _parse_ideas(raw) == [
        "Első ötlet",
        "Második ötlet",
        "Harmadik ötlet",
        "Negyedik ötlet",
    ]


def test_parse_plain_paragraph_lines():
    raw = "A hős elárulja a mestert.\nA kard hamisítvány."
    assert _parse_ideas(raw) == [
        "A hős elárulja a mestert.",
        "A kard hamisítvány.",
    ]


# ── unusable → None (caller degrades) ────────────────────────────────────────


@pytest.mark.parametrize("raw", ["", "   ", " \n  \n "])
def test_parse_whitespace_only_returns_none(raw):
    assert _parse_ideas(raw) is None
