/**
 * Typed endpoint function for the Markdown export (M8 Export).
 *
 * Backend contract (`apps/api/app/api/v1/exports.py`):
 *   POST /books/{book_id}/exports
 *     → 200 text/markdown; charset=utf-8
 *       Content-Disposition: attachment; filename="<ascii>.md"; filename*=UTF-8''<utf8>
 *     → 404 { detail: "Book not found" }
 *
 * The endpoint exports the WHOLE book (no scope param exists server-side). The
 * UI still offers Teljes könyv / fejezet / jelenet radios per the prototype;
 * book scope hits this real endpoint, chapter/scene scope are V1 (the page
 * surfaces an honest "(V1-ben érkezik)" note and keeps the button book-scoped).
 *
 * This is NOT a JSON endpoint, so it bypasses `apiFetch` (which is JSON-only)
 * and reads the body as text. Errors are never swallowed: a non-OK response
 * throws an `ApiError` carrying the status + a useful message.
 */
import {
  API_BASE_URL,
  ApiError,
  getAuthToken,
} from "./client";
import { filenameFromContentDisposition, markdownFilename } from "@/lib/slugify";

const API_PREFIX = "/api/v1";

/** The result of a Markdown export: the file content + the resolved filename. */
export interface MarkdownExport {
  /** The raw Markdown document body. */
  content: string;
  /**
   * The download filename. Honors the server's `Content-Disposition` when
   * present; otherwise falls back to the client-side ASCII-fold of the title.
   */
  filename: string;
}

/**
 * Export a book as Markdown. Resolves with the content + the download filename.
 *
 * @param bookId       the book to export (whole-book scope — see module note).
 * @param titleForName the book title, used only for the client-side filename
 *                     fallback when the server omits a `Content-Disposition`.
 */
export async function exportBookMarkdown(
  bookId: string,
  titleForName: string,
): Promise<MarkdownExport> {
  const headers: Record<string, string> = { Accept: "text/markdown" };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${API_PREFIX}/books/${bookId}/exports`, {
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

  const content = await res.text();
  const headerName = filenameFromContentDisposition(
    res.headers.get("Content-Disposition"),
  );
  const filename = headerName ?? markdownFilename(titleForName);

  return { content, filename };
}
