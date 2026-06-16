"""Pandoc CLI conversion for DOCX / EPUB export (Feature #2a).

The native-Python Markdown generators in `export_service` produce the document
body; this module converts that Markdown to a binary format (DOCX / EPUB) by
shelling out to the `pandoc` CLI. Pandoc is installed in the API Docker image
(and on CI), but NOT necessarily on a developer machine — so every failure mode
is surfaced LOUDLY and actionably, never as a silent empty download or a raw
500 traceback:

  * pandoc not on PATH        -> PandocUnavailableError -> 503 (actionable)
  * pandoc exits non-zero     -> PandocConversionError  (sanitized stderr) -> 502
  * pandoc exceeds the timeout-> PandocConversionError  -> 502

The endpoint maps these to clear HTTP responses. stderr is sanitized so no
absolute temp paths leak into the client-facing message.
"""

from __future__ import annotations

import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Literal

PandocFormat = Literal["docx", "epub"]

#: Per-conversion subprocess timeout (seconds). Pandoc is fast even for a full
#: book; a generous cap still prevents a hung/zombie process from wedging a
#: request worker indefinitely.
_PANDOC_TIMEOUT_SECONDS = 60

#: Pandoc's writer name + the produced file extension for each supported format.
_FORMAT_EXTENSION: dict[PandocFormat, str] = {"docx": "docx", "epub": "epub"}


class PandocError(RuntimeError):
    """Base class for pandoc conversion failures."""


class PandocUnavailableError(PandocError):
    """Raised when the `pandoc` binary is not available on PATH.

    The endpoint turns this into a 503 with an actionable message — this is an
    environment/deployment gap (pandoc not installed), not a client error and
    not an unexpected server crash.
    """


class PandocConversionError(PandocError):
    """Raised when pandoc runs but fails (non-zero exit, or a timeout).

    Carries an already-sanitized message safe to surface to the client (no
    absolute paths / secrets).
    """


def _safe_error(raw: str) -> str:
    """Sanitize pandoc stderr for client display.

    Strips absolute filesystem paths (the temp dir we created) and collapses
    whitespace so the message can't leak local paths or run on for pages. Keeps
    enough of pandoc's own diagnostic to be useful.
    """
    text = raw.strip()
    if not text:
        return "pandoc reported no further detail."
    # Drop anything that looks like an absolute path (POSIX or Windows temp).
    text = re.sub(r"(/[^\s]+|[A-Za-z]:\\[^\s]+)", "<path>", text)
    text = re.sub(r"\s+", " ", text).strip()
    # Bound the length so a verbose pandoc dump can't flood the response.
    return text[:500]


def pandoc_available() -> bool:
    """Return True when the `pandoc` binary is resolvable on PATH."""
    return shutil.which("pandoc") is not None


def convert_markdown(
    markdown: str,
    target: PandocFormat,
    *,
    title: str | None = None,
) -> bytes:
    """Convert `markdown` to `target` (docx/epub) bytes via the pandoc CLI.

    The Markdown is written to a temp file and pandoc writes the binary output to
    another temp file (DOCX/EPUB are binary container formats — they cannot be
    streamed to stdout reliably, so an output file is required); the bytes are
    read back and the temp directory is always cleaned up.

    Args:
        markdown: the document body (from the export_service generators).
        target:   "docx" or "epub".
        title:    document title — passed as pandoc metadata (EPUB requires a
                  title; DOCX uses it for document properties). Falls back to a
                  neutral default so EPUB never emits its "no title" warning.

    Raises:
        PandocUnavailableError: pandoc is not installed (PATH miss) -> 503.
        PandocConversionError:  pandoc exited non-zero or timed out -> 502.
    """
    pandoc = shutil.which("pandoc")
    if pandoc is None:
        raise PandocUnavailableError(
            "DOCX/EPUB export requires pandoc; not available on this server. "
            "Install pandoc (the API Docker image and CI provide it)."
        )

    extension = _FORMAT_EXTENSION[target]
    # EPUB always needs a title; DOCX benefits from one. Never empty.
    doc_title = (title or "").strip() or "Untitled"

    with tempfile.TemporaryDirectory(prefix="woa-export-") as tmp:
        tmp_dir = Path(tmp)
        input_path = tmp_dir / "input.md"
        output_path = tmp_dir / f"output.{extension}"
        input_path.write_text(markdown, encoding="utf-8")

        cmd = [
            pandoc,
            str(input_path),
            "-f",
            "markdown",
            "-t",
            target,
            "--metadata",
            f"title={doc_title}",
            "-o",
            str(output_path),
        ]

        try:
            result = subprocess.run(  # noqa: S603 — fixed argv, no shell, pandoc resolved via which
                cmd,
                capture_output=True,
                timeout=_PANDOC_TIMEOUT_SECONDS,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise PandocConversionError(
                f"pandoc timed out after {_PANDOC_TIMEOUT_SECONDS}s while "
                f"producing {target.upper()}."
            ) from exc
        except OSError as exc:
            # e.g. binary vanished between which() and run(), permission error.
            raise PandocConversionError(
                f"pandoc could not be executed: {_safe_error(str(exc))}"
            ) from exc

        if result.returncode != 0:
            stderr = result.stderr.decode("utf-8", errors="replace")
            raise PandocConversionError(
                f"pandoc failed to produce {target.upper()}: {_safe_error(stderr)}"
            )

        if not output_path.exists():
            raise PandocConversionError(
                f"pandoc reported success but produced no {target.upper()} output."
            )

        return output_path.read_bytes()


def convert_docx_to_markdown(docx_bytes: bytes) -> str:
    """Convert DOCX bytes to Markdown via the pandoc CLI (import direction, #2b).

    Mirrors :func:`convert_markdown` (same robustness contract) but the OTHER
    way: the uploaded ``.docx`` bytes are written to a temp file and pandoc reads
    them with ``-f docx -t markdown``, emitting Markdown the import parser then
    structures into chapters/scenes. The Markdown is captured from stdout (text,
    unlike the binary DOCX/EPUB writers), the temp dir is always cleaned up, and
    every failure mode is surfaced LOUDLY — never a silent empty import.

    Raises:
        PandocUnavailableError: pandoc is not installed (PATH miss) -> 503.
        PandocConversionError:  pandoc exited non-zero, timed out, or produced no
                                output -> 502.
    """
    pandoc = shutil.which("pandoc")
    if pandoc is None:
        raise PandocUnavailableError(
            "DOCX import requires pandoc; not available on this server. "
            "Install pandoc (the API Docker image and CI provide it)."
        )

    with tempfile.TemporaryDirectory(prefix="woa-import-") as tmp:
        input_path = Path(tmp) / "input.docx"
        input_path.write_bytes(docx_bytes)

        cmd = [
            pandoc,
            str(input_path),
            "-f",
            "docx",
            "-t",
            "markdown",
        ]

        try:
            result = subprocess.run(  # noqa: S603 — fixed argv, no shell, pandoc resolved via which
                cmd,
                capture_output=True,
                timeout=_PANDOC_TIMEOUT_SECONDS,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            raise PandocConversionError(
                f"pandoc timed out after {_PANDOC_TIMEOUT_SECONDS}s while "
                "reading the DOCX."
            ) from exc
        except OSError as exc:
            raise PandocConversionError(
                f"pandoc could not be executed: {_safe_error(str(exc))}"
            ) from exc

        if result.returncode != 0:
            stderr = result.stderr.decode("utf-8", errors="replace")
            raise PandocConversionError(
                f"pandoc failed to read the DOCX: {_safe_error(stderr)}"
            )

        return result.stdout.decode("utf-8", errors="replace")
