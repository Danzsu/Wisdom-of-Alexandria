/**
 * Typed endpoint functions for the Series resource (Feature #3a).
 *
 * Series are nested under a project (`apps/api/app/api/v1/series.py`, prefix
 * `/projects/{project_id}/series` under `/api/v1`):
 *   GET    /projects/{pid}/series          → SeriesRead[]
 *   GET    /projects/{pid}/series/{sid}    → SeriesRead
 *   POST   /projects/{pid}/series          → SeriesRead (201)
 *   PATCH  /projects/{pid}/series/{sid}    → SeriesRead
 *   DELETE /projects/{pid}/series/{sid}    → 204
 *
 * A Series groups books within a project; a Codex entry can be project-global
 * (`series_id = null`) or scoped to one series. Responses are validated with Zod
 * before reaching the UI, so a contract drift surfaces as a thrown error rather
 * than a silent shape mismatch.
 */
import { apiFetch } from "./client";
import {
  seriesCreateSchema,
  seriesListSchema,
  seriesReadSchema,
  seriesUpdateSchema,
  type SeriesCreate,
  type SeriesRead,
  type SeriesUpdate,
} from "./types";

/** List the series belonging to a project. */
export async function listSeries(projectId: string): Promise<SeriesRead[]> {
  const data = await apiFetch<unknown>(`/projects/${projectId}/series`);
  return seriesListSchema.parse(data);
}

/** Fetch a single series within a project. */
export async function getSeries(
  projectId: string,
  seriesId: string,
): Promise<SeriesRead> {
  const data = await apiFetch<unknown>(
    `/projects/${projectId}/series/${seriesId}`,
  );
  return seriesReadSchema.parse(data);
}

/** Create a series under a project. The payload is validated first. */
export async function createSeries(
  projectId: string,
  input: SeriesCreate,
): Promise<SeriesRead> {
  const body = seriesCreateSchema.parse(input);
  const data = await apiFetch<unknown>(`/projects/${projectId}/series`, {
    method: "POST",
    body,
  });
  return seriesReadSchema.parse(data);
}

/** Patch a series (title / description / order). The payload is validated. */
export async function updateSeries(
  projectId: string,
  seriesId: string,
  patch: SeriesUpdate,
): Promise<SeriesRead> {
  const body = seriesUpdateSchema.parse(patch);
  const data = await apiFetch<unknown>(
    `/projects/${projectId}/series/${seriesId}`,
    { method: "PATCH", body },
  );
  return seriesReadSchema.parse(data);
}

/** Delete a series (the backend answers 204; apiFetch returns null). */
export async function deleteSeries(
  projectId: string,
  seriesId: string,
): Promise<void> {
  await apiFetch<unknown>(`/projects/${projectId}/series/${seriesId}`, {
    method: "DELETE",
  });
}
