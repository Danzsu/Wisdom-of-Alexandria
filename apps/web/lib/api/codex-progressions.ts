/**
 * Typed endpoint functions for the CodexProgression resource (Progresszió tab).
 * FLAT router (`apps/api/app/api/v1/codex_progressions.py`, prefix
 * `/codex-progressions` under `/api/v1`):
 *   GET    /codex-progressions?entity_type=&entity_id=  → CodexProgressionRead[]
 *   POST   /codex-progressions                          → CodexProgressionRead (201)
 *   GET    /codex-progressions/{id}                     → CodexProgressionRead
 *   PATCH  /codex-progressions/{id}                     → CodexProgressionRead
 *   DELETE /codex-progressions/{id}                     → 204
 *
 * A progression records an entity's state change, optionally anchored to a
 * chapter and/or scene (anchorless = project-global baseline). The backend CRUD
 * lists by `created_at desc`; STORY ordering (the order the AI-context
 * linearization uses) is computed client-side from the book tree — see
 * `components/codex/progression-tab.tsx`. Each function validates its response
 * with Zod — backend drift throws rather than silently flowing a wrong shape.
 */
import { apiFetch } from "./client";
import {
  codexProgressionCreateSchema,
  codexProgressionListSchema,
  codexProgressionReadSchema,
  codexProgressionUpdateSchema,
  type CodexProgressionCreate,
  type CodexProgressionRead,
  type CodexProgressionUpdate,
} from "./types";

/** List the progressions recorded for one entity (`entity_type` + id). */
export async function listCodexProgressions(
  entityType: string,
  entityId: string,
): Promise<CodexProgressionRead[]> {
  const query = new URLSearchParams({
    entity_type: entityType,
    entity_id: entityId,
  });
  const data = await apiFetch<unknown>(`/codex-progressions?${query}`);
  return codexProgressionListSchema.parse(data);
}

/** Create a progression. The payload is validated before it is sent. */
export async function createCodexProgression(
  input: CodexProgressionCreate,
): Promise<CodexProgressionRead> {
  const body = codexProgressionCreateSchema.parse(input);
  const data = await apiFetch<unknown>(`/codex-progressions`, {
    method: "POST",
    body,
  });
  return codexProgressionReadSchema.parse(data);
}

/** Patch a progression's anchor and/or note. */
export async function updateCodexProgression(
  progressionId: string,
  patch: CodexProgressionUpdate,
): Promise<CodexProgressionRead> {
  const body = codexProgressionUpdateSchema.parse(patch);
  const data = await apiFetch<unknown>(
    `/codex-progressions/${progressionId}`,
    { method: "PATCH", body },
  );
  return codexProgressionReadSchema.parse(data);
}

/** Delete a progression (the backend answers 204; apiFetch returns null). */
export async function deleteCodexProgression(
  progressionId: string,
): Promise<void> {
  await apiFetch<unknown>(`/codex-progressions/${progressionId}`, {
    method: "DELETE",
  });
}
