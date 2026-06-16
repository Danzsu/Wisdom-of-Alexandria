/**
 * Typed client for the project JSON backup/restore endpoints (Feature #5).
 *
 * Backend contract (`apps/api/app/api/v1/backups.py`, domain base):
 *   GET  /projects/{project_id}/backup
 *     → 200 application/json (the whole project graph), Content-Disposition
 *           attachment; filename="<slug>-backup.json"
 *     → 404 project not found
 *   POST /projects/restore   (multipart/form-data, field: file = the .json)
 *     → 201 RestoreSummary { project_id, title, <per-collection>_count }
 *     → 400 empty / not-valid-JSON upload
 *     → 413 over the size cap
 *     → 422 malformed / unsupported-version payload
 *
 * Both bypass `apiFetch` (the backup download is a Blob, the restore is a
 * multipart upload — neither is the JSON request/response `apiFetch` handles).
 * Errors are NEVER swallowed: a non-OK response throws an `ApiError` carrying
 * the status + the server's `{ detail }` message so the UI can surface the
 * 400/413/422 reason verbatim.
 */
import {
  API_BASE_URL,
  API_PREFIX,
  ApiError,
  getAuthToken,
} from "./client";
import { downloadBlob } from "./export-hooks";
import { filenameFromContentDisposition } from "@/lib/slugify";
import { z } from "zod";

/** Result of a successful restore (mirrors the backend `RestoreSummary`). */
export const restoreSummarySchema = z.object({
  project_id: z.string().min(1),
  title: z.string(),
  series_count: z.number().int(),
  book_count: z.number().int(),
  chapter_count: z.number().int(),
  scene_count: z.number().int(),
  beat_count: z.number().int(),
  codex_entry_count: z.number().int(),
  character_count: z.number().int(),
  location_count: z.number().int(),
  worldbuilding_count: z.number().int(),
  snippet_count: z.number().int(),
  style_guide_count: z.number().int(),
  codex_relation_count: z.number().int(),
  codex_progression_count: z.number().int(),
});
export type RestoreSummary = z.infer<typeof restoreSummarySchema>;

/** Extract the server's `{ detail }` message from a non-OK response (or null). */
async function readDetail(res: Response): Promise<string | null> {
  try {
    const body = (await res.clone().json()) as { detail?: unknown };
    if (typeof body.detail === "string") return body.detail;
  } catch {
    // Non-JSON error body — caller falls back to a status message.
  }
  return null;
}

/**
 * Download a project's JSON backup and trigger a browser save. Resolves with the
 * download filename actually used (server `Content-Disposition` honored;
 * otherwise a `<projectId>-backup.json` fallback). Throws `ApiError` on any
 * non-OK status or transport failure — never a silent no-op.
 */
export async function exportBackup(projectId: string): Promise<string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${API_BASE_URL}${API_PREFIX}/projects/${projectId}/backup`;

  let res: Response;
  try {
    res = await fetch(url, { method: "GET", headers });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Nem sikerült elérni a szervert.";
    throw new ApiError(0, message, cause);
  }

  if (!res.ok) {
    const detail = await readDetail(res);
    throw new ApiError(
      res.status,
      detail ?? `A biztonsági mentés sikertelen (HTTP ${res.status}).`,
      detail,
    );
  }

  const raw = await res.blob();
  const blob =
    raw.type === "application/json"
      ? raw
      : new Blob([raw], { type: "application/json" });

  const filename =
    filenameFromContentDisposition(res.headers.get("Content-Disposition")) ??
    `${projectId}-backup.json`;

  downloadBlob(blob, filename);
  return filename;
}

/**
 * Restore a JSON backup file into a brand-new project. Resolves with the
 * restore summary (the new project id + per-collection counts). Throws
 * `ApiError` carrying the server's 400/413/422 detail on failure — never
 * swallowed.
 *
 * @param file the `.json` backup File (from a file input).
 */
export async function restoreBackup(file: File): Promise<RestoreSummary> {
  const form = new FormData();
  form.append("file", file);

  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `${API_BASE_URL}${API_PREFIX}/projects/restore`;

  let res: Response;
  try {
    // NOTE: do NOT set Content-Type — the browser sets the multipart boundary.
    res = await fetch(url, { method: "POST", headers, body: form });
  } catch (cause) {
    const message =
      cause instanceof Error ? cause.message : "Nem sikerült elérni a szervert.";
    throw new ApiError(0, message, cause);
  }

  if (!res.ok) {
    const detail = await readDetail(res);
    throw new ApiError(
      res.status,
      detail ?? `A visszaállítás sikertelen (HTTP ${res.status}).`,
      detail,
    );
  }

  const data = (await res.json()) as unknown;
  return restoreSummarySchema.parse(data);
}
