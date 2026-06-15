"""Plain-text helpers for manuscript content.

Scene/revision content is rich text (HTML-ish markup from the Tiptap editor).
Word counts must be computed over the *visible* text, not the raw markup, so a
``<p>`` wrapper or formatting tags never inflate the count. This helper is the
single source of truth so the autosave path and the approve path cannot drift.
"""

import re

# Matches HTML/XML-style tags (e.g. ``<p>``, ``</strong>``, ``<br/>``). Kept
# deliberately simple and dependency-free — good enough to strip editor markup
# before counting words.
_TAG_RE = re.compile(r"<[^>]+>")


def count_words(content: str | None) -> int:
    """Count words in ``content`` after stripping HTML/markup tags.

    ``None`` or whitespace-only content counts as 0. Tags are replaced with a
    space (not removed) so ``"<p>a</p><p>b</p>"`` does not collapse into one
    token.
    """
    if not content:
        return 0
    stripped = _TAG_RE.sub(" ", content)
    return len(stripped.split())
