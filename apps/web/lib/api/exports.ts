/**
 * Typed endpoint function for the Markdown export (M8 Export).
 *
 * Backend contract (`apps/api/app/api/v1/exports.py`):
 *   POST /books/{book_id}/exports?scope=<book|chapter|scene>&target_id=<uuid>
 *     → 200 text/markdown; charset=utf-8
 *       Content-Disposition: attachment; filename="<ascii>.md"; filename*=UTF-8''<utf8>
 *     → 404 { detail: "Book/Chapter/Scene not found" }
 *     → 422 when scope≠book and target_id is missing
 *
 * The endpoint exports the WHOLE book (scope=book, the default) OR a single
 * chapter / scene (scope=chapter|scene + the chapter/scene `target_id`). The UI
 * offers Teljes könyv / fejezet / jelenet radios; for chapter/scene the user
 * picks WHICH chapter/scene, and the chosen id is sent as `target_id`. Ownership
 * is validated server-side (the chapter must belong to the book, the scene to a
 * chapter of the book) — a foreign id yields a 404.
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

/** Export scope (tartomány) — mirrors the backend `scope` query param. */
export type ExportScope = "book" | "chapter" | "scene";

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

/** Options for {@link exportBookMarkdown}: the export scope + optional target. */
export interface ExportMarkdownOptions {
  /** Export tartomány. Defaults to whole-book. */
  scope?: ExportScope;
  /** Chapter / scene id — REQUIRED (and only used) when scope ≠ book. */
  targetId?: string;
}

/**
 * Export a book / chapter / scene as Markdown. Resolves with the content + the
 * download filename.
 *
 * @param bookId       the book that owns the export target.
 * @param titleForName the scope-appropriate title (book / chapter / scene),
 *                     used only for the client-side filename fallback when the
 *                     server omits a `Content-Disposition`.
 * @param options      the export `scope` and (for chapter/scene) the `targetId`.
 */
export async function exportBookMarkdown(
  bookId: string,
  titleForName: string,
  options: ExportMarkdownOptions = {},
): Promise<MarkdownExport> {
  const { scope = "book", targetId } = options;
  const headers: Record<string, string> = { Accept: "text/markdown" };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const query = new URLSearchParams({ scope });
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

  const content = await res.text();
  const headerName = filenameFromContentDisposition(
    res.headers.get("Content-Disposition"),
  );
  const filename = headerName ?? markdownFilename(titleForName);

  return { content, filename };
}
