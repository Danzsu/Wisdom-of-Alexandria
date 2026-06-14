/**
 * Typed endpoint functions for the Codex resource (read-only for M4).
 *
 * Codex entries are PROJECT-scoped (`apps/api/app/api/v1/codex.py`, prefix
 * `/projects/{project_id}/codex` under `/api/v1`):
 *   GET    /projects/{pid}/codex          → CodexEntryRead[]
 *
 * M4 only needs the read path to source the CodexMention hover popover; full
 * Codex CRUD (and the book→project resolution that the sidebar needs) is M6.
 */
import { apiFetch } from "./client";
import {
  codexEntryListSchema,
  type CodexEntryRead,
} from "./types";

/** List the codex entries belonging to a project. */
export async function listCodexEntries(
  projectId: string,
): Promise<CodexEntryRead[]> {
  const data = await apiFetch<unknown>(`/projects/${projectId}/codex`);
  return codexEntryListSchema.parse(data);
}
