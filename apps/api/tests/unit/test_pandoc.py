"""Unit tests for the pandoc conversion util (app.services.pandoc).

The mocked tests run everywhere (they patch at the subprocess / which boundary);
the round-trip test is gated on a real pandoc binary and SKIPS locally, RUNS in
CI (where the workflow installs pandoc) — mirroring the @pytest.mark.postgres
skip pattern.
"""

import subprocess
from types import SimpleNamespace

import pytest

from app.services import pandoc
from app.services.pandoc import (
    PandocConversionError,
    PandocUnavailableError,
    convert_markdown,
    pandoc_available,
)

pytestmark = pytest.mark.unit


def test_builds_correct_invocation(monkeypatch, tmp_path):
    """convert_markdown calls pandoc with the right -f/-t/-o + title metadata."""
    monkeypatch.setattr(pandoc.shutil, "which", lambda _: "/usr/bin/pandoc")

    seen = {}

    def fake_run(cmd, **kwargs):
        seen["cmd"] = cmd
        seen["timeout"] = kwargs.get("timeout")
        # pandoc writes the -o target; emulate that so read_bytes succeeds.
        out_index = cmd.index("-o") + 1
        with open(cmd[out_index], "wb") as fh:
            fh.write(b"PKfake-docx-bytes")
        return SimpleNamespace(returncode=0, stdout=b"", stderr=b"")

    monkeypatch.setattr(pandoc.subprocess, "run", fake_run)

    data = convert_markdown("# Hello", "docx", title="A könyv")

    assert data == b"PKfake-docx-bytes"
    cmd = seen["cmd"]
    assert cmd[0] == "/usr/bin/pandoc"
    assert "-f" in cmd and cmd[cmd.index("-f") + 1] == "markdown"
    assert "-t" in cmd and cmd[cmd.index("-t") + 1] == "docx"
    assert "--metadata" in cmd and "title=A könyv" in cmd
    assert "-o" in cmd
    # A timeout is always set (no unbounded hang).
    assert isinstance(seen["timeout"], int) and seen["timeout"] > 0


def test_title_falls_back_to_untitled(monkeypatch):
    """An empty/blank title becomes 'Untitled' (EPUB requires a title)."""
    monkeypatch.setattr(pandoc.shutil, "which", lambda _: "/usr/bin/pandoc")

    captured = {}

    def fake_run(cmd, **kwargs):
        captured["cmd"] = cmd
        out_index = cmd.index("-o") + 1
        with open(cmd[out_index], "wb") as fh:
            fh.write(b"PKepub")
        return SimpleNamespace(returncode=0, stdout=b"", stderr=b"")

    monkeypatch.setattr(pandoc.subprocess, "run", fake_run)

    convert_markdown("body", "epub", title="   ")
    assert "title=Untitled" in captured["cmd"]


def test_missing_pandoc_raises_unavailable(monkeypatch):
    """which() returning None -> PandocUnavailableError (a clear, actionable error)."""
    monkeypatch.setattr(pandoc.shutil, "which", lambda _: None)

    with pytest.raises(PandocUnavailableError) as exc:
        convert_markdown("# x", "docx", title="t")
    assert "pandoc" in str(exc.value).lower()


def test_nonzero_exit_raises_conversion_error_sanitized(monkeypatch):
    """Non-zero exit -> PandocConversionError with sanitized stderr (no paths)."""
    monkeypatch.setattr(pandoc.shutil, "which", lambda _: "/usr/bin/pandoc")

    def fake_run(cmd, **kwargs):
        return SimpleNamespace(
            returncode=1,
            stdout=b"",
            stderr=b"pandoc: error reading /tmp/woa-export-abc/input.md secret",
        )

    monkeypatch.setattr(pandoc.subprocess, "run", fake_run)

    with pytest.raises(PandocConversionError) as exc:
        convert_markdown("# x", "docx", title="t")
    message = str(exc.value)
    # Absolute path is scrubbed; the diagnostic gist remains.
    assert "/tmp/woa-export-abc/input.md" not in message
    assert "<path>" in message


def test_timeout_raises_conversion_error(monkeypatch):
    """A subprocess timeout surfaces as PandocConversionError, not a raw crash."""
    monkeypatch.setattr(pandoc.shutil, "which", lambda _: "/usr/bin/pandoc")

    def fake_run(cmd, **kwargs):
        raise subprocess.TimeoutExpired(cmd, kwargs.get("timeout", 60))

    monkeypatch.setattr(pandoc.subprocess, "run", fake_run)

    with pytest.raises(PandocConversionError) as exc:
        convert_markdown("# x", "epub", title="t")
    assert "timed out" in str(exc.value).lower()


# --- pandoc-gated REAL round-trip (skips locally, runs in CI) -------------- #


@pytest.mark.pandoc
@pytest.mark.skipif(
    not pandoc_available(), reason="pandoc CLI not on PATH (installed in CI)"
)
@pytest.mark.parametrize("fmt", ["docx", "epub"])
def test_real_conversion_roundtrip_produces_zip(fmt):
    """REAL md->docx/epub conversion: non-empty bytes with the ZIP magic (PK)."""
    data = convert_markdown(
        "# Cím\n\nElső bekezdés.\n", fmt, title="Teszt könyv"
    )
    assert isinstance(data, bytes)
    assert len(data) > 0
    # DOCX and EPUB are both ZIP containers -> they start with the PK signature.
    assert data[:2] == b"PK"
