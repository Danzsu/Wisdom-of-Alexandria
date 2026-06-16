/**
 * Typed client for the DOCX import endpoint (#2b).
 *
 * Backend contract (`apps/api/app/api/v1/imports.py`, domain base):
 *   POST /projects/{project_id}/imports   (multipart/form-data)
 *     fields: file (the .docx, required), title (optional)
 *     → 201 BookImportSummary { book_id, title, chapter_count, scene_count, word_count }
 *     → 400 non-.docx / empty file
 *     → 413 over the size cap
 *     → 422 the document produced no importable content
 *     → 502 pandoc conversion failed   → 503 pandoc not installed
 *     → 404 project not found
 *
 * This is a multipart upload, so it bypasses `apiFetch` (JSON-only). Errors are
 * NEVER swallowed: a non-OK response throws an `ApiError` carrying the status +
 * the server's `{ detail }` message (so the UI can surface the 400/413/502/503
 * reason verbatim).
 */
import {
  API_BASE_URL,
  API_PREFIX,
  ApiError,
  getAuthToken,
} from "./client";
import { z } from "zod";

/** Result of a successful import (mirrors `BookImportSummary`). */
export const bookImportSummarySchema = z.object({
  book_id: z.string().min(1),
  title: z.string(),
  chapter_count: z.number().int(),
  scene_count: z.number().int(),
  word_count: z.number().int(),
});
export type BookImportSummary = z.infer<typeof bookImportSummarySchema>;

/**
 * Import a `.docx` as a new book under a project. Resolves with the import
 * summary (the created book id + structure counts). The optional `title`
 * overrides the server-derived title.
 *
 * @param projectId the project the new book is created under.
 * @param file      the `.docx` File (from a file input).
 * @param title     optional explicit book title.
 */
export async function importDocx(
  projectId: string,
  file: File,
  title?: string,
): Promise<BookImportSummary> {
  const form = new FormData();
  form.append("file", file);
  const trimmed = title?.trim();
  if (trimmed) form.append("title", trimmed);

  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${API_BASE_URL}${API_PREFIX}/projects/${projectId}/imports`;

  let res: Response;
  try {
    // NOTE: do NOT set Content-Type — the browser sets the multipart boundary.
    res = await fetch(url, { method: "POST", headers, body: form });
  } catch (cause) {
    const message =
      cause instanceof Error
        ? cause.message
        : "Nem sikerült elérni a szervert.";
    throw new ApiError(0, message, cause);
  }

  if (!res.ok) {
    let detail: string | null = null;
    try {
      const body = (await res.clone().json()) as { detail?: unknown };
      if (typeof body.detail === "string") detail = body.detail;
    } catch {
      // Non-JSON error body — fall back to a status message below rather than
      // masking the failure.
    }
    throw new ApiError(
      res.status,
      detail ?? `Az importálás sikertelen (HTTP ${res.status}).`,
      detail,
    );
  }

  const data = (await res.json()) as unknown;
  return bookImportSummarySchema.parse(data);
}
