/**
 * Typed endpoint functions for the project-scoped Style Guide (Stíluskalauz).
 *
 * The StyleGuide is ONE-PER-PROJECT (`apps/api/app/api/v1/style_guide.py`,
 * prefix `/projects/{project_id}/style-guide` under `/api/v1`):
 *   GET    /projects/{pid}/style-guide   → StyleGuideRead (404 when none yet)
 *   PATCH  /projects/{pid}/style-guide   → StyleGuideRead (404 when none yet)
 *
 * The Stíluskalauz screen is book-scoped in the URL; it resolves the book's
 * owning `project_id` (via `resolveBookById`) before hitting these routes. A
 * missing guide is a real, expected state (the API answers 404) — callers map
 * that to the empty state, NOT a hard error.
 */
import { apiFetch } from "./client";
import { styleGuideReadSchema, type StyleGuideRead } from "./types";

/** Patch payload — the subset of editable StyleGuide fields (all optional). */
export interface StyleGuideUpdate {
  tone?: string | null;
  pov?: string | null;
  tense?: string | null;
  rules?: Record<string, unknown> | null;
  examples?: Record<string, unknown> | null;
  notes?: string | null;
}

/** Fetch the project's style guide. Throws `ApiError(404)` when none exists. */
export async function getStyleGuide(
  projectId: string,
): Promise<StyleGuideRead> {
  const data = await apiFetch<unknown>(`/projects/${projectId}/style-guide`);
  return styleGuideReadSchema.parse(data);
}

/** Patch the project's style guide (404 when none exists yet). */
export async function updateStyleGuide(
  projectId: string,
  patch: StyleGuideUpdate,
): Promise<StyleGuideRead> {
  const data = await apiFetch<unknown>(`/projects/${projectId}/style-guide`, {
    method: "PATCH",
    body: patch,
  });
  return styleGuideReadSchema.parse(data);
}
