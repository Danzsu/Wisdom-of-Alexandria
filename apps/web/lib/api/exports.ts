/**
 * Typed endpoint function for the book/chapter/scene export (M8 Export + #2a).
 *
 * Backend contract (`apps/api/app/api/v1/exports.py`):
 *   POST /books/{book_id}/exports?scope=<book|chapter|scene>&target_id=<uuid>&format=<md|docx|epub>
 *     → 200 text/markdown; charset=utf-8                      (format=md, default)
 *       200 application/vnd.openxmlformats-…wordprocessingml.document (format=docx)
 *       200 application/epub+zip                              (format=epub)
 *       Content-Disposition: attachment; filename="<ascii>.<ext>"; filename*=UTF-8''<utf8>
 *     → 404 { detail: "Book/Chapter/Scene not found" }
 *     → 422 when scope≠book and target_id is missing
 *     → 503 { detail } when pandoc is not installed (docx/epub)
 *     → 502 { detail } when the pandoc conversion fails (docx/epub)
 *
 * The endpoint exports the WHOLE book (scope=book, the default) OR a single
 * chapter / scene (scope=chapter|scene + the chapter/scene `target_id`), in
 * Markdown (native) or DOCX/EPUB (converted server-side via pandoc). Ownership
 * is validated server-side — a foreign id yields a 404.
 *
 * This is NOT a JSON endpoint, so it bypasses `apiFetch` (which is JSON-only).
 * Markdown is read as text; DOCX/EPUB are binary and read as a Blob. Errors are
 * never swallowed: a non-OK response throws an `ApiError` carrying the status +
 * a useful message.
 */
import {
  API_BASE_URL,
  ApiError,
  getAuthToken,
} from "./client";
import { filenameFromContentDisposition, exportFilename } from "@/lib/slugify";

const API_PREFIX = "/api/v1";

/** Export scope (tartomány) — mirrors the backend `scope` query param. */
export type ExportScope = "book" | "chapter" | "scene";

/** Export format — mirrors the backend `format` query param. */
export type ExportFormatId = "md" | "docx" | "epub";

/** The blob MIME type the browser download should use, per format. */
export const FORMAT_MIME: Record<ExportFormatId, string> = {
  md: "text/markdown;charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  epub: "application/epub+zip",
};

/** The result of an export: the file data (Blob) + the resolved filename. */
export interface ExportResult {
  /** The document body as a Blob (text for md; binary for docx/epub). */
  blob: Blob;
  /**
   * The download filename. Honors the server's `Content-Disposition` when
   * present; otherwise falls back to the client-side ASCII-fold of the title
   * with the format-correct extension.
   */
  filename: string;
}

/** Options for {@link exportBook}: the export scope + format + optional target. */
export interface ExportOptions {
  /** Export tartomány. Defaults to whole-book. */
  scope?: ExportScope;
  /** Output format. Defaults to Markdown. */
  format?: ExportFormatId;
  /** Chapter / scene id — REQUIRED (and only used) when scope ≠ book. */
  targetId?: string;
}

/**
 * Export a book / chapter / scene in the requested format. Resolves with the
 * file Blob + the download filename.
 *
 * @param bookId       the book that owns the export target.
 * @param titleForName the scope-appropriate title (book / chapter / scene),
 *                     used only for the client-side filename fallback when the
 *                     server omits a `Content-Disposition`.
 * @param options      the export `scope`, `format` and (for chapter/scene) the
 *                     `targetId`.
 */
export async function exportBook(
  bookId: string,
  titleForName: string,
  options: ExportOptions = {},
): Promise<ExportResult> {
  const { scope = "book", format = "md", targetId } = options;
  const mime = FORMAT_MIME[format];
  const headers: Record<string, string> = { Accept: mime };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const query = new URLSearchParams({ scope, format });
  if (scope !== "book" && targetId) query.set("target_id", targetId);
  const url = `${API_BASE_URL}${API_PREFIX}/books/${bookId}/exports?${query.toString()}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
    });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Nem sikerült elérni a szervert.";
    throw new ApiError(0, message, cause);
  }

  if (!res.ok) {
    // Try to surface the FastAPI `{ detail }` message; fall back to the status.
    let detail: string | null = null;
    try {
      const body = (await res.clone().json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // The error body was not JSON — fine, we fall back to a status message
      // below rather than masking the failure.
    }
    throw new ApiError(
      res.status,
      detail ?? `Az exportálás sikertelen (HTTP ${res.status}).`,
      detail,
    );
  }

  // Read the body as a Blob so the same path works for text (md) and binary
  // (docx/epub). Re-tag the blob with our known MIME so the download type is
  // correct even if the server omitted/altered the content-type.
  const raw = await res.blob();
  const blob =
    raw.type === mime ? raw : new Blob([raw], { type: mime });

  const headerName = filenameFromContentDisposition(
    res.headers.get("Content-Disposition"),
  );
  const filename = headerName ?? exportFilename(titleForName, format);

  return { blob, filename };
}
