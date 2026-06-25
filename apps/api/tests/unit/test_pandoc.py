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
    PdfEngineUnavailableError,
    convert_docx_to_markdown,
    convert_markdown,
    pandoc_available,
    pdf_engine_available,
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


# --- PDF (format=pdf, via --pdf-engine) ------------------------------------ #


def test_pdf_builds_invocation_with_pdf_engine(monkeypatch):
    """convert_markdown('pdf') passes -t pdf + --pdf-engine=weasyprint."""
    # pandoc AND the weasyprint engine both resolve.
    monkeypatch.setattr(
        pandoc.shutil,
        "which",
        lambda name: "/usr/bin/pandoc" if name == "pandoc" else "/usr/bin/weasyprint",
    )

    seen = {}

    def fake_run(cmd, **kwargs):
        seen["cmd"] = cmd
        seen["timeout"] = kwargs.get("timeout")
        out_index = cmd.index("-o") + 1
        with open(cmd[out_index], "wb") as fh:
            fh.write(b"%PDF-1.7 fake")
        return SimpleNamespace(returncode=0, stdout=b"", stderr=b"")

    monkeypatch.setattr(pandoc.subprocess, "run", fake_run)

    data = convert_markdown("# Cím", "pdf", title="A könyv")

    assert data == b"%PDF-1.7 fake"
    cmd = seen["cmd"]
    assert cmd[0] == "/usr/bin/pandoc"
    assert "-t" in cmd and cmd[cmd.index("-t") + 1] == "pdf"
    # The PDF engine is wired through pandoc's --pdf-engine flag.
    assert "--pdf-engine=weasyprint" in cmd
    assert "--metadata" in cmd and "title=A könyv" in cmd
    assert isinstance(seen["timeout"], int) and seen["timeout"] > 0


def test_pdf_missing_pandoc_raises_unavailable(monkeypatch):
    """No pandoc at all -> PandocUnavailableError (mapped to 503)."""
    monkeypatch.setattr(pandoc.shutil, "which", lambda _: None)

    with pytest.raises(PandocUnavailableError):
        convert_markdown("# x", "pdf", title="t")


def test_pdf_missing_engine_raises_pdf_engine_unavailable(monkeypatch):
    """pandoc present but the PDF engine absent -> PdfEngineUnavailableError.

    This is the distinct, actionable 'engine not installed' path — NOT a generic
    pandoc failure and NOT an opaque 500.
    """
    # pandoc resolves, but weasyprint does not.
    monkeypatch.setattr(
        pandoc.shutil,
        "which",
        lambda name: "/usr/bin/pandoc" if name == "pandoc" else None,
    )

    with pytest.raises(PdfEngineUnavailableError) as exc:
        convert_markdown("# x", "pdf", title="t")
    assert "weasyprint" in str(exc.value).lower()


def test_pdf_engine_available_requires_both(monkeypatch):
    """pdf_engine_available() is True only when pandoc AND the engine resolve."""
    monkeypatch.setattr(
        pandoc.shutil,
        "which",
        lambda name: "/usr/bin/pandoc" if name == "pandoc" else "/usr/bin/weasyprint",
    )
    assert pdf_engine_available() is True

    # Engine missing -> False even though pandoc is present.
    monkeypatch.setattr(
        pandoc.shutil,
        "which",
        lambda name: "/usr/bin/pandoc" if name == "pandoc" else None,
    )
    assert pdf_engine_available() is False


def test_pdf_nonzero_exit_raises_conversion_error_sanitized(monkeypatch):
    """A pandoc PDF failure -> PandocConversionError with the temp path scrubbed."""
    monkeypatch.setattr(
        pandoc.shutil,
        "which",
        lambda name: "/usr/bin/pandoc" if name == "pandoc" else "/usr/bin/weasyprint",
    )

    def fake_run(cmd, **kwargs):
        return SimpleNamespace(
            returncode=1,
            stdout=b"",
            stderr=b"pandoc: weasyprint died on /tmp/woa-export-q/input.md",
        )

    monkeypatch.setattr(pandoc.subprocess, "run", fake_run)

    with pytest.raises(PandocConversionError) as exc:
        convert_markdown("# x", "pdf", title="t")
    message = str(exc.value)
    assert "/tmp/woa-export-q/input.md" not in message
    assert "<path>" in message


# --- DOCX -> Markdown (import direction, #2b) ------------------------------ #


def test_docx_to_markdown_builds_correct_invocation(monkeypatch):
    """convert_docx_to_markdown calls pandoc -f docx -t markdown, returns stdout."""
    monkeypatch.setattr(pandoc.shutil, "which", lambda _: "/usr/bin/pandoc")

    seen = {}

    def fake_run(cmd, **kwargs):
        seen["cmd"] = cmd
        seen["timeout"] = kwargs.get("timeout")
        return SimpleNamespace(
            returncode=0, stdout=b"# Cim\n\nSzoveg.\n", stderr=b""
        )

    monkeypatch.setattr(pandoc.subprocess, "run", fake_run)

    md = convert_docx_to_markdown(b"PKfake-docx-bytes")

    assert md == "# Cim\n\nSzoveg.\n"
    cmd = seen["cmd"]
    assert cmd[0] == "/usr/bin/pandoc"
    assert "-f" in cmd and cmd[cmd.index("-f") + 1] == "docx"
    assert "-t" in cmd and cmd[cmd.index("-t") + 1] == "markdown"
    assert isinstance(seen["timeout"], int) and seen["timeout"] > 0


def test_docx_to_markdown_missing_pandoc_raises_unavailable(monkeypatch):
    """which() == None -> PandocUnavailableError (mapped to 503 at the endpoint)."""
    monkeypatch.setattr(pandoc.shutil, "which", lambda _: None)

    with pytest.raises(PandocUnavailableError) as exc:
        convert_docx_to_markdown(b"x")
    assert "pandoc" in str(exc.value).lower()


def test_docx_to_markdown_nonzero_exit_sanitized(monkeypatch):
    """Non-zero exit -> PandocConversionError with the temp path scrubbed."""
    monkeypatch.setattr(pandoc.shutil, "which", lambda _: "/usr/bin/pandoc")

    def fake_run(cmd, **kwargs):
        return SimpleNamespace(
            returncode=1,
            stdout=b"",
            stderr=b"pandoc: cannot read /tmp/woa-import-xyz/input.docx",
        )

    monkeypatch.setattr(pandoc.subprocess, "run", fake_run)

    with pytest.raises(PandocConversionError) as exc:
        convert_docx_to_markdown(b"x")
    message = str(exc.value)
    assert "/tmp/woa-import-xyz/input.docx" not in message
    assert "<path>" in message


def test_docx_to_markdown_timeout_raises_conversion_error(monkeypatch):
    """A subprocess timeout surfaces as PandocConversionError, not a raw crash."""
    monkeypatch.setattr(pandoc.shutil, "which", lambda _: "/usr/bin/pandoc")

    def fake_run(cmd, **kwargs):
        raise subprocess.TimeoutExpired(cmd, kwargs.get("timeout", 60))

    monkeypatch.setattr(pandoc.subprocess, "run", fake_run)

    with pytest.raises(PandocConversionError) as exc:
        convert_docx_to_markdown(b"x")
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


@pytest.mark.pandoc
@pytest.mark.skipif(
    not pdf_engine_available(),
    reason="pandoc or the PDF engine (weasyprint) not on PATH (installed in CI)",
)
def test_real_pdf_conversion_produces_pdf():
    """REAL md->pdf conversion via --pdf-engine: non-empty bytes, %PDF header."""
    data = convert_markdown(
        "# Cím\n\nElső bekezdés.\n", "pdf", title="Teszt könyv"
    )
    assert isinstance(data, bytes)
    assert len(data) > 0
    # Every PDF file starts with the "%PDF" magic.
    assert data[:4] == b"%PDF"


@pytest.mark.pandoc
@pytest.mark.skipif(
    not pandoc_available(), reason="pandoc CLI not on PATH (installed in CI)"
)
def test_real_docx_to_markdown_roundtrip():
    """REAL round-trip: build a docx via pandoc, read it back, headings survive.

    Avoids a python-docx dependency by using pandoc itself to MAKE the docx
    (md -> docx), then exercising the import direction (docx -> md). The chapter
    heading + body text must reappear in the recovered Markdown.
    """
    docx_bytes = convert_markdown(
        "# Első fejezet\n\nElső bekezdés szövege.\n", "docx", title="Teszt"
    )
    assert docx_bytes[:2] == b"PK"

    recovered = convert_docx_to_markdown(docx_bytes)
    assert "Első fejezet" in recovered
    assert "Első bekezdés szövege." in recovered
