/**
 * Typed endpoint functions + domain codec for the Codex resource.
 *
 * Codex entries are PROJECT-scoped (`apps/api/app/api/v1/codex.py`, prefix
 * `/projects/{project_id}/codex` under `/api/v1`):
 *   GET    /projects/{pid}/codex            → CodexEntryRead[]
 *   GET    /projects/{pid}/codex/{id}       → CodexEntryRead
 *   POST   /projects/{pid}/codex            → CodexEntryRead (201)
 *   PATCH  /projects/{pid}/codex/{id}       → CodexEntryRead
 *   DELETE /projects/{pid}/codex/{id}       → 204
 *
 * REAL BACKEND CONTRACT (apps/api/app/schemas/codex_entry.py): a Codex entry is
 * a GENERIC card with `title` (the NAME), `entry_type`, `content` (the
 * DESCRIPTION), `ai_visible` and a single `tags` list. There are NO dedicated
 * `aliases` / `role` columns. The prototype's Character Detail shows separate
 * Álnevek (aliases) + Story-role fields, so we fold those into the real `tags`
 * array via a small, documented codec.
 *
 * BACKEND GAP: the proper MVP fix is a real `aliases: string[]` + `role: string`
 * (+ a name-tracking opt-out) column on `codex_entry`. Until the schema grows
 * those, this namespaced codec is the interim workaround.
 *
 * Encoding scheme — internal control keys live under a `__woa:` sentinel that a
 * user/seed/API free-form tag cannot reasonably author, so they are NEVER
 * confused with a plain label:
 *
 *   - an alias        → "__woa:alias=<value>"   (e.g. "__woa:alias=Lené")
 *   - the story role  → "__woa:role=<value>"    (single, e.g. "__woa:role=Hős")
 *   - name-tracking off → "__woa:tracking=off"  (absence ⇒ tracking on)
 *   - any other tag   → a free-form label ("+ címke" chips)
 *
 * `decodeTags` recognises ONLY sentinel-prefixed keys as structured; everything
 * else (including a literal "alias:foo" / "role:X" / "tracking:off") is a plain
 * user label and is returned in `labels`. `encodeTags` rebuilds the flat list.
 *
 * Guarantees: `encode(decode(tags))` is stable (idempotent) for already-encoded
 * input — user-label order is preserved, aliases are de-duplicated, and multiple
 * `__woa:role=` keys collapse to the LAST one (last wins, no crash). Empty /
 * whitespace-only values are trimmed and skipped. The sentinel keys are stripped
 * from `labels`, so no internal key ever surfaces as a visible chip.
 *
 * Backward-compatibility: the OLD bare `alias:` / `role:` / `tracking:off`
 * scheme is NOT read. Any pre-existing local-dev data on the old scheme now
 * decodes as plain labels (harmless, fully visible, never corrupted). This is a
 * local-dev-only app with no migration burden; the seed fixture was moved to the
 * new scheme so tests reflect reality.
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
 * tags codec — aliases / role / labels ↔ the flat backend `tags` list.
 * ------------------------------------------------------------------------- */

/**
 * Sentinel namespace for the codec's internal control keys. A plain user/seed/
 * API tag cannot reasonably author this prefix, so structured data is never
 * confused with a free-form label. Centralised here — never inline the strings.
 */
const SENTINEL = "__woa:";
const ALIAS_KEY = `${SENTINEL}alias=`;
const ROLE_KEY = `${SENTINEL}role=`;
const TRACKING_OFF = `${SENTINEL}tracking=off`;

/** True when a raw tag is one of this codec's internal control keys. */
export function isControlTag(tag: string): boolean {
  return tag.startsWith(SENTINEL);
}

/** The decoded view of a codex entry's `tags` list. */
export interface DecodedTags {
  /** Recognition names (Álnevek / Becenevek). */
  aliases: string[];
  /** The single story role, or null. */
  role: string | null;
  /** Free-form labels ("+ címke" chips) — anything not an alias or role. */
  labels: string[];
  /** Name-tracking opt-out: true ⇒ "__woa:tracking=off" present. */
  trackingOff: boolean;
}

/**
 * Split a raw `tags` list into { aliases, role, labels, trackingOff }.
 *
 * Only `__woa:`-prefixed keys are treated as structured. A literal user tag such
 * as "alias:foo", "role:X", or "tracking:off" is returned verbatim in `labels`
 * — never misclassified. Internal sentinels never leak into `labels`.
 */
export function decodeTags(tags: readonly string[]): DecodedTags {
  const aliasSeen = new Set<string>();
  const aliases: string[] = [];
  const labels: string[] = [];
  let role: string | null = null;
  let trackingOff = false;
  for (const tag of tags) {
    if (tag.startsWith(ALIAS_KEY)) {
      const value = tag.slice(ALIAS_KEY.length).trim();
      const key = value.toLowerCase();
      if (value && !aliasSeen.has(key)) {
        aliasSeen.add(key);
        aliases.push(value);
      }
    } else if (tag.startsWith(ROLE_KEY)) {
      // Multiple role keys: last non-empty wins (documented), never crashes.
      const value = tag.slice(ROLE_KEY.length).trim();
      role = value || null;
    } else if (tag === TRACKING_OFF) {
      trackingOff = true;
    } else if (isControlTag(tag)) {
      // Unknown sentinel key — drop it so no internal token surfaces as a chip.
    } else {
      const value = tag.trim();
      if (value) labels.push(value);
    }
  }
  return { aliases, role, labels, trackingOff };
}

/**
 * Rebuild the flat `tags` list from a decoded view (the PATCH/POST shape).
 * `encode(decode(tags))` is stable for already-encoded input: aliases dedup,
 * user-label order preserved, empties skipped.
 */
export function encodeTags({
  aliases,
  role,
  labels,
  trackingOff,
}: DecodedTags): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const alias of aliases) {
    const value = alias.trim();
    const key = value.toLowerCase();
    if (value && !seen.has(key)) {
      seen.add(key);
      out.push(`${ALIAS_KEY}${value}`);
    }
  }
  if (role?.trim()) out.push(`${ROLE_KEY}${role.trim()}`);
  for (const label of labels) {
    const value = label.trim();
    // A label that happens to be a sentinel key would round-trip into structured
    // data; drop it defensively (decode never emits one into `labels` anyway).
    if (value && !isControlTag(value)) out.push(value);
  }
  if (trackingOff) out.push(TRACKING_OFF);
  return out;
}

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
