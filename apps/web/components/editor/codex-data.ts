/**
 * Codex lookup for the CodexMention hover popover (M4).
 *
 * SEAM (M6): the real Codex list is project-scoped and owned by M6's Codex CRUD
 * + sidebar. M4 only renders mention marks with a read-only hover card, so we
 * carry a small typed placeholder keyed by the mention label. `useCodexEntries`
 * (lib/api/hooks) exists for M6 to wire the live list; the Write route only has
 * `bookId` (codex needs `project_id`), so resolving the live list is deferred to
 * M6 when the book→project link is available. The labels + descriptions here are
 * verbatim from the prototype mentions (Alexandria App.dc.html ~line 665).
 */

/** Visual type of a codex entry (drives the avatar tone in the popover). */
export type CodexMentionKind = "character" | "location";

/** A resolved codex entry for the mention popover. */
export interface CodexMentionEntry {
  /** Stable id (placeholder until M6 wires real ids). */
  id: string;
  /** The mention label as it appears in the manuscript. */
  label: string;
  /** Short type line, e.g. "Karakter · főszereplő". */
  typeLine: string;
  /** Visual kind for the avatar. */
  kind: CodexMentionKind;
  /** POV color slot for character avatars (1–6), or null for locations. */
  povSlot: number | null;
  /** Avatar initials (characters only). */
  initials: string | null;
  /** Description shown in the popover body. */
  description: string;
}

/** Placeholder codex entries, keyed by mention label (lowercased). */
export const CODEX_MENTIONS: Record<string, CodexMentionEntry> = {
  szelene: {
    id: "codex-szelene",
    label: "Szelene",
    typeLine: "Karakter · főszereplő",
    kind: "character",
    povSlot: 2,
    initials: "SZ",
    description:
      "A Nagykönyvtár éjszakai írnoka; apja eltűnése óta a rejtett jeleket kutatja.",
  },
  nagykönyvtár: {
    id: "codex-nagykonyvtar",
    label: "Nagykönyvtár",
    typeLine: "Helyszín",
    kind: "location",
    povSlot: null,
    initials: null,
    description:
      "Alexandria nagy könyvtára; a keleti szárny rejti a tiltott termeket.",
  },
  damianosz: {
    id: "codex-damianosz",
    label: "Damianosz",
    typeLine: "Karakter · szövetséges",
    kind: "character",
    povSlot: 4,
    initials: "D",
    description: "Őr a keleti szárnyban; fedezi Szelene éjszakai kutatásait.",
  },
};

/** Resolve a mention label to its codex entry, or null when unknown. */
export function resolveCodexMention(
  label: string,
): CodexMentionEntry | null {
  return CODEX_MENTIONS[label.trim().toLowerCase()] ?? null;
}
