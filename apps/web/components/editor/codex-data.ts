/**
 * Codex lookup for the CodexMention hover popover.
 *
 * M6 wires this to the REAL project Codex. The Write route only carries
 * `bookId`, so the live list is resolved via `useBookProjectId(bookId)` →
 * `useCodexEntries(projectId)` (see the CodexMentionDataProvider in
 * `codex-mention-data.tsx`) and threaded to the mention NodeView through a
 * React context. {@link buildCodexMentionIndex} turns the real
 * `CodexEntryRead[]` into the label-keyed index the popover renders; the
 * static `CODEX_MENTIONS` below is the FALLBACK used only when no provider is
 * mounted (e.g. the extension unit harness).
 */
import { povSlot } from "@/lib/pov-color";
import type { CodexEntryRead } from "@/lib/api/types";

/** Visual type of a codex entry (drives the avatar tone in the popover). */
export type CodexMentionKind = "character" | "location";

/** A resolved codex entry for the mention popover. */
export interface CodexMentionEntry {
  /** Stable id (real codex id once wired). */
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

/** A label→entry index the popover resolves against. */
export type CodexMentionIndex = Record<string, CodexMentionEntry>;

/** 1–2 char initials from a name (mirrors the kit Avatar logic). */
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const HU_TYPE_LINE: Record<string, string> = {
  character: "Karakter",
  location: "Helyszín",
  object: "Tárgy",
  organization: "Szervezet",
  lore: "Lore",
  rule: "Szabály",
};

/**
 * Build the label-keyed mention index from the real project Codex. A character
 * gets a POV-coloured initials avatar (stable per name); other types render as
 * a location-style chip in the popover. Each entry is indexed by its title AND
 * every alias (lowercased) so a mention of an alias still resolves.
 */
export function buildCodexMentionIndex(
  entries: readonly CodexEntryRead[],
): CodexMentionIndex {
  const index: CodexMentionIndex = {};
  for (const entry of entries) {
    const { aliases, role } = entry;
    const isCharacter = entry.entry_type === "character";
    const typeName = HU_TYPE_LINE[entry.entry_type] ?? "Bejegyzés";
    const mention: CodexMentionEntry = {
      id: entry.id,
      label: entry.title,
      typeLine: role ? `${typeName} · ${role}` : typeName,
      kind: isCharacter ? "character" : "location",
      povSlot: isCharacter ? povSlot(entry.title) : null,
      initials: isCharacter ? initialsFrom(entry.title) : null,
      description: entry.content?.trim() ?? "",
    };
    index[entry.title.trim().toLowerCase()] = mention;
    for (const alias of aliases) {
      const key = alias.trim().toLowerCase();
      if (key && !index[key]) index[key] = { ...mention, label: alias };
    }
  }
  return index;
}

/**
 * Resolve a mention label against an optional live index, falling back to the
 * static placeholder map when the index is absent or has no match. Passing
 * `null` (no provider mounted) reproduces the pre-M6 behaviour exactly.
 */
export function resolveCodexMention(
  label: string,
  index?: CodexMentionIndex | null,
): CodexMentionEntry | null {
  const key = label.trim().toLowerCase();
  return index?.[key] ?? CODEX_MENTIONS[key] ?? null;
}
