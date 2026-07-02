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


# --- Cover embedding (EPUB flag / PDF cover page) --------------------------- #


def _fake_run_writing_output(seen):
    """Build a fake subprocess.run that records cmd + the input.md content and
    writes the -o target so convert_markdown's read_bytes succeeds."""

    def fake_run(cmd, **kwargs):
        seen["cmd"] = cmd
        # cmd[1] is the input file (see convert_markdown's argv layout); read it
        # NOW — the temp dir is destroyed after convert_markdown returns.
        with open(cmd[1], encoding="utf-8") as fh:
            seen["input_md"] = fh.read()
        out_index = cmd.index("-o") + 1
        with open(cmd[out_index], "wb") as fh:
            fh.write(b"PKfake-bytes")
        return SimpleNamespace(returncode=0, stdout=b"", stderr=b"")

    return fake_run


def test_epub_cover_path_adds_epub_cover_image_flag(monkeypatch, tmp_path):
    """EPUB + cover_path -> a single `--epub-cover-image=<path>` argv element.

    The path deliberately contains a SPACE: because the invocation is an argv
    list (no shell), the whole flag must survive as ONE element — no quoting
    or splitting.
    """
    monkeypatch.setattr(pandoc.shutil, "which", lambda _: "/usr/bin/pandoc")
    cover_dir = tmp_path / "my covers"
    cover_dir.mkdir()
    cover = cover_dir / "cover art.png"
    cover.write_bytes(b"\x89PNGfake")

    seen = {}
    monkeypatch.setattr(pandoc.subprocess, "run", _fake_run_writing_output(seen))

    convert_markdown("# Cím", "epub", title="A könyv", cover_path=str(cover))

    assert f"--epub-cover-image={cover}" in seen["cmd"]
    # The body itself is untouched (the cover goes in via the flag, not markup).
    assert seen["input_md"] == "# Cím"


def test_epub_without_cover_has_no_cover_flag(monkeypatch):
    """No cover_path -> the argv contains NO --epub-cover-image element."""
    monkeypatch.setattr(pandoc.shutil, "which", lambda _: "/usr/bin/pandoc")
    seen = {}
    monkeypatch.setattr(pandoc.subprocess, "run", _fake_run_writing_output(seen))

    convert_markdown("# Cím", "epub", title="t")

    assert not any(arg.startswith("--epub-cover-image") for arg in seen["cmd"])


def test_docx_ignores_cover_path(monkeypatch, tmp_path):
    """DOCX has no pandoc cover concept: no flag, and the markdown is unchanged."""
    monkeypatch.setattr(pandoc.shutil, "which", lambda _: "/usr/bin/pandoc")
    cover = tmp_path / "cover.png"
    cover.write_bytes(b"\x89PNGfake")

    seen = {}
    monkeypatch.setattr(pandoc.subprocess, "run", _fake_run_writing_output(seen))

    convert_markdown("# Cím\n\nbody", "docx", title="t", cover_path=str(cover))

    assert not any(arg.startswith("--epub-cover-image") for arg in seen["cmd"])
    assert seen["input_md"] == "# Cím\n\nbody"


def test_pdf_cover_page_prepended_with_file_uri(monkeypatch, tmp_path):
    """PDF + cover_path -> a raw-HTML cover page (file:// img + page break) is
    prepended to the markdown handed to pandoc/weasyprint; the original body
    follows it. No EPUB flag leaks into the PDF invocation."""
    from pathlib import Path

    monkeypatch.setattr(
        pandoc.shutil,
        "which",
        lambda name: "/usr/bin/pandoc" if name == "pandoc" else "/usr/bin/weasyprint",
    )
    cover = tmp_path / "cover.png"
    cover.write_bytes(b"\x89PNGfake")

    seen = {}
    monkeypatch.setattr(pandoc.subprocess, "run", _fake_run_writing_output(seen))

    convert_markdown("# Cím\n\nbody", "pdf", title="t", cover_path=str(cover))

    input_md = seen["input_md"]
    expected_uri = Path(cover).resolve().as_uri()
    # The image is referenced by its file:// URI inside an <img> tag …
    assert f'src="{expected_uri}"' in input_md
    # … on a page of its own (weasyprint honours the CSS page break) …
    assert "page-break-after" in input_md
    # … BEFORE the original body, which is intact after it.
    assert input_md.index("page-break-after") < input_md.index("# Cím")
    assert input_md.endswith("# Cím\n\nbody")
    assert not any(arg.startswith("--epub-cover-image") for arg in seen["cmd"])


def test_pdf_cover_path_with_spaces_is_uri_escaped(monkeypatch, tmp_path):
    """A cover path with spaces cannot break the injected HTML: the src is a
    percent-encoded file URI (no raw space inside the attribute)."""
    from pathlib import Path

    monkeypatch.setattr(
        pandoc.shutil,
        "which",
        lambda name: "/usr/bin/pandoc" if name == "pandoc" else "/usr/bin/weasyprint",
    )
    cover_dir = tmp_path / "my covers"
    cover_dir.mkdir()
    cover = cover_dir / "cover art.png"
    cover.write_bytes(b"\x89PNGfake")

    seen = {}
    monkeypatch.setattr(pandoc.subprocess, "run", _fake_run_writing_output(seen))

    convert_markdown("body", "pdf", title="t", cover_path=str(cover))

    expected_uri = Path(cover).resolve().as_uri()
    assert "%20" in expected_uri  # the URI form really did escape the spaces
    assert f'src="{expected_uri}"' in seen["input_md"]
    # The raw (space-containing) path never appears inside the src attribute.
    assert f'src="{cover}"' not in seen["input_md"]


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
