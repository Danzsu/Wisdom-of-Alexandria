/**
 * Typed endpoint functions + small helpers for the Codex resource.
 *
 * Codex entries are PROJECT-scoped (`apps/api/app/api/v1/codex.py`, prefix
 * `/projects/{project_id}/codex` under `/api/v1`):
 *   GET    /projects/{pid}/codex            → CodexEntryRead[]
 *   GET    /projects/{pid}/codex/{id}       → CodexEntryRead
 *   POST   /projects/{pid}/codex            → CodexEntryRead (201)
 *   PATCH  /projects/{pid}/codex/{id}       → CodexEntryRead
 *   DELETE /projects/{pid}/codex/{id}       → 204
 *
 * BACKEND CONTRACT (apps/api/app/schemas/codex_entry.py): since P1.4 a Codex card
 * carries DEDICATED `aliases: string[]` (recognition names) + `role: string|null`
 * (the single story role) columns, mirroring `Character`. `content` is the
 * DESCRIPTION, `ai_visible` is the spoiler-protection AI gate, and `tags` is a
 * list of plain user labels.
 *
 * HISTORY: M6 had no `aliases` / `role` columns, so the UI folded those (plus a
 * "name-tracking off" flag) into `tags` via a `__woa:` namespaced codec. P1.4
 * added the real columns and REMOVED that codec entirely — aliases + role now
 * come from / go to their own fields, and `tags` is purely user labels. The M6
 * "track by name" toggle had no backend gate (the real AI gate is `ai_visible`,
 * a separate column), so it is now UI-only local state in the Tracking tab — no
 * residual `__woa:` tag is written. See `components/codex/codex-detail.tsx`.
 */
import { apiFetch } from "./client";
import {
  codexEntryListSchema,
  codexEntryReadSchema,
  codexEntryCreateSchema,
  codexEntryUpdateSchema,
  type CodexEntryCreate,
  type CodexEntryRead,
  type CodexEntryUpdate,
} from "./types";

/* ---------------------------------------------------------------------------
 * Entry types (mirrors CLAUDE.md + the prototype's type picker).
 * ------------------------------------------------------------------------- */

/** The codex entry types the New-Codex modal offers (slug = `entry_type`). */
export const CODEX_ENTRY_TYPES = [
  "character",
  "location",
  "object",
  "organization",
  "lore",
  "rule",
] as const;

export type CodexEntryType = (typeof CODEX_ENTRY_TYPES)[number];

/** Narrow an arbitrary `entry_type` string to a known type, or null. */
export function asCodexEntryType(value: string): CodexEntryType | null {
  return (CODEX_ENTRY_TYPES as readonly string[]).includes(value)
    ? (value as CodexEntryType)
    : null;
}

/* ---------------------------------------------------------------------------
 * Alias input parsing — comma-separated free text → a clean alias list.
 * ------------------------------------------------------------------------- */

/** Parse a comma-separated alias input into a deduped, trimmed list. */
export function parseAliasInput(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const value = part.trim();
    if (value && !seen.has(value.toLowerCase())) {
      seen.add(value.toLowerCase());
      out.push(value);
    }
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Manuscript mention scan — the single source of truth for "N megemlítés".
 * Shared by the detail header AND the sidebar so the count is the same real
 * scene-content scan everywhere (NOT the alias count). MVP corpus is small, so
 * one pass over the already-cached book tree is cheap.
 * ------------------------------------------------------------------------- */

/** The recognition needles for an entry: its title + decoded aliases. */
export function mentionNeedles(
  title: string,
  aliases: readonly string[],
): string[] {
  return [title, ...aliases]
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
}

/** Case-insensitive containment of any needle in a scene's content. */
export function contentMentions(
  content: string | null | undefined,
  needles: readonly string[],
): boolean {
  if (!content) return false;
  const haystack = content.toLowerCase();
  return needles.some((n) => haystack.includes(n.toLowerCase()));
}

/** The minimal scene shape the mention scan reads (chapter+scene tree). */
export interface MentionScene {
  content: string | null;
}
export interface MentionChapter {
  scenes: readonly MentionScene[];
}

/** Count scenes (across the book tree) that mention any of `needles`. */
export function countMentions(
  chapters: readonly MentionChapter[],
  needles: readonly string[],
): number {
  if (needles.length === 0) return 0;
  let count = 0;
  for (const chapter of chapters) {
    for (const scene of chapter.scenes) {
      if (contentMentions(scene.content, needles)) count += 1;
    }
  }
  return count;
}

/* ---------------------------------------------------------------------------
 * Endpoint functions (each validates the response with Zod — drift throws).
 * ------------------------------------------------------------------------- */

/** List the codex entries belonging to a project. */
export async function listCodexEntries(
  projectId: string,
): Promise<CodexEntryRead[]> {
  const data = await apiFetch<unknown>(`/projects/${projectId}/codex`);
  return codexEntryListSchema.parse(data);
}

/** Fetch a single codex entry by id. */
export async function getCodexEntry(
  projectId: string,
  entryId: string,
): Promise<CodexEntryRead> {
  const data = await apiFetch<unknown>(
    `/projects/${projectId}/codex/${entryId}`,
  );
  return codexEntryReadSchema.parse(data);
}

/** Create a codex entry under a project. The payload is validated first. */
export async function createCodexEntry(
  projectId: string,
  input: CodexEntryCreate,
): Promise<CodexEntryRead> {
  const body = codexEntryCreateSchema.parse(input);
  const data = await apiFetch<unknown>(`/projects/${projectId}/codex`, {
    method: "POST",
    body,
  });
  return codexEntryReadSchema.parse(data);
}

/** Patch a codex entry (name / type / description / ai_visible / tags). */
export async function updateCodexEntry(
  projectId: string,
  entryId: string,
  patch: CodexEntryUpdate,
): Promise<CodexEntryRead> {
  const body = codexEntryUpdateSchema.parse(patch);
  const data = await apiFetch<unknown>(
    `/projects/${projectId}/codex/${entryId}`,
    { method: "PATCH", body },
  );
  return codexEntryReadSchema.parse(data);
}

/** Delete a codex entry (the backend answers 204; apiFetch returns null). */
export async function deleteCodexEntry(
  projectId: string,
  entryId: string,
): Promise<void> {
  await apiFetch<unknown>(`/projects/${projectId}/codex/${entryId}`, {
    method: "DELETE",
  });
}
