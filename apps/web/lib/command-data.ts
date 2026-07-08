/**
 * Command-palette result model + REAL search (gap-fix #1 — replaces the static
 * M2 demo list).
 *
 * The palette searches the ACTIVE BOOK's real data, built client-side from the
 * caches the shell already maintains:
 *   - scenes from the book tree (title + owning chapter as meta) → Write route,
 *   - codex entries (name + localized type as meta) → codex route with the
 *     entry preselected via the `?entry=` param (see `useCodexSelection`),
 *   - the actions group (export / theme / shortcuts / how-it-works) — export is
 *     book-scoped and therefore only offered inside a book.
 *
 * Matching is case- and accent-insensitive (NFD + combining-mark strip, so
 * "muszak" finds "műszak"); ranking is simple and deterministic: label prefix >
 * label substring > meta substring, ties broken by input order. An empty query
 * shows a capped default (first scenes/codex entries + every action).
 */
import { routes } from "./routes";
import { hu } from "./i18n/hu";
import type { ChapterWithScenes } from "./api/hooks";
import type { CodexEntryRead } from "./api/types";

/** Command-palette result groups. */
export type CommandGroupKey = "scenes" | "codex" | "actions";

export interface CommandResult {
  id: string;
  group: CommandGroupKey;
  /** Primary label (matched against the query). */
  label: string;
  /** Secondary label shown to the right (also searched, at the lowest rank). */
  meta?: string;
  /** Destination route for navigable results. */
  href?: string;
  /** Non-navigable action kind (handled by the palette). */
  action?: "export" | "theme" | "shortcuts" | "howItWorks";
}

/** How many scene/codex rows the empty-query default shows per group. */
export const EMPTY_QUERY_GROUP_LIMIT = 5;

/**
 * The REAL actions. Export navigates to the book's export screen, so it is
 * only offered when a book is active; the rest are global.
 */
export function buildActionResults(bookId: string | null): CommandResult[] {
  const actions: CommandResult[] = [];
  if (bookId) {
    actions.push({
      id: "action-export",
      group: "actions",
      label: hu.command.actionExport,
      href: routes.book(bookId, "export"),
    });
  }
  actions.push(
    {
      id: "action-theme",
      group: "actions",
      label: hu.command.actionTheme,
      action: "theme",
    },
    {
      id: "action-shortcuts",
      group: "actions",
      label: hu.command.actionShortcuts,
      action: "shortcuts",
    },
    {
      id: "action-how-it-works",
      group: "actions",
      label: hu.command.actionHowItWorks,
      action: "howItWorks",
    },
  );
  return actions;
}

/** Scene results from the loaded book tree — each row keeps its chapter context. */
export function buildSceneResults(
  chapters: ChapterWithScenes[],
  bookId: string,
): CommandResult[] {
  return chapters.flatMap((chapter) =>
    chapter.scenes.map((scene) => ({
      id: `scene-${scene.id}`,
      group: "scenes" as const,
      label: scene.title,
      meta: chapter.title,
      href: routes.scene(bookId, scene.id),
    })),
  );
}

/**
 * Codex results — navigating opens the codex screen with the entry selected
 * (the `?entry=` query param is the codex screen's selection contract).
 */
export function buildCodexResults(
  entries: CodexEntryRead[],
  bookId: string,
): CommandResult[] {
  return entries.map((entry) => ({
    id: `codex-${entry.id}`,
    group: "codex" as const,
    label: entry.title,
    meta: hu.codex.typeLabel[entry.entry_type] ?? entry.entry_type,
    href: `${routes.book(bookId, "codex")}?entry=${encodeURIComponent(entry.id)}`,
  }));
}

/* ----------------------------------------------------------------------------
   Persisted recents (design pushRecent parity — 2026-07 canvas refresh).
   The mock keeps the last 6 selected commands in localStorage
   ("woa-recent-cmds"), dedup by label, newest first, and shows them as a
   group on empty query. Our stored shape keeps enough to RE-EXECUTE the row:
   group (leading visual), href OR action (the target). Scene/codex hrefs can
   go stale after a deletion — navigating to a stale route is acceptable, so
   no liveness data is stored and none is checked.
   -------------------------------------------------------------------------- */

/** localStorage key for the persisted command-palette recents (mock parity). */
export const RECENT_COMMANDS_KEY = "woa-recent-cmds";

/** Cap on stored recents (mock parity). */
export const RECENT_COMMANDS_MAX = 6;

/** One persisted recent — label for display + dedup, group + target to re-run. */
export interface RecentCommand {
  label: string;
  group: CommandGroupKey;
  href?: string;
  action?: CommandResult["action"];
}

const GROUP_KEYS: readonly CommandGroupKey[] = ["scenes", "codex", "actions"];
const ACTION_KINDS: readonly NonNullable<CommandResult["action"]>[] = [
  "export",
  "theme",
  "shortcuts",
  "howItWorks",
];

/**
 * Read the persisted recents. Malformed storage (bad JSON, non-array, junk
 * items) degrades gracefully: junk entries are dropped, an unknown group is
 * coerced to "actions" (only the leading visual depends on it), non-string
 * targets are discarded, and the list is capped at {@link RECENT_COMMANDS_MAX}.
 */
export function readRecentCommands(): RecentCommand[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_COMMANDS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as Record<string, unknown>).label === "string" &&
          (item as Record<string, unknown>).label !== "",
      )
      .map((item) => ({
        label: item.label as string,
        group: GROUP_KEYS.includes(item.group as CommandGroupKey)
          ? (item.group as CommandGroupKey)
          : "actions",
        ...(typeof item.href === "string" ? { href: item.href } : {}),
        ...(ACTION_KINDS.includes(
          item.action as NonNullable<CommandResult["action"]>,
        )
          ? { action: item.action as CommandResult["action"] }
          : {}),
      }))
      .slice(0, RECENT_COMMANDS_MAX);
  } catch {
    // Bad JSON or storage access denied — behave as "no recents".
    return [];
  }
}

/**
 * Push an executed result onto the persisted recents (mock pushRecent parity):
 * dedup by label, unshift, cap at {@link RECENT_COMMANDS_MAX}. Storage errors
 * (quota, privacy mode) are swallowed — recents are a convenience, never a
 * reason to break the selection itself.
 */
export function pushRecentCommand(result: CommandResult): void {
  if (typeof window === "undefined") return;
  const entry: RecentCommand = {
    label: result.label,
    group: result.group,
    ...(result.href ? { href: result.href } : {}),
    ...(result.action ? { action: result.action } : {}),
  };
  const next = [
    entry,
    ...readRecentCommands().filter((r) => r.label !== entry.label),
  ].slice(0, RECENT_COMMANDS_MAX);
  try {
    window.localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(next));
  } catch {
    // Quota/privacy failures: the selection still executes, just unrecorded.
  }
}

/**
 * Render the stored recents as palette rows. Ids are index-based
 * (`recent-N`) so a recent NEVER collides with the live row for the same
 * target when both are on screen (empty query shows recents + defaults).
 */
export function recentCommandResults(
  recents: RecentCommand[],
): CommandResult[] {
  return recents.map((recent, index) => ({
    id: `recent-${index}`,
    group: recent.group,
    label: recent.label,
    href: recent.href,
    action: recent.action,
  }));
}

/** Lowercase + strip combining marks, so "arnyek" matches "Árnyék". */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Match rank: 0 = label prefix, 1 = label substring, 2 = meta substring. */
function rankOf(result: CommandResult, q: string): number | null {
  const label = normalizeForSearch(result.label);
  if (label.startsWith(q)) return 0;
  if (label.includes(q)) return 1;
  if (result.meta && normalizeForSearch(result.meta).includes(q)) return 2;
  return null;
}

/**
 * Filter + rank results for a query. An empty query returns the sensible
 * default: the first {@link EMPTY_QUERY_GROUP_LIMIT} scene/codex rows plus
 * every action. Non-matching results are dropped; matches are ordered by rank
 * (prefix > substring > meta), ties by input order (stable).
 */
export function searchCommands(
  results: CommandResult[],
  query: string,
): CommandResult[] {
  const q = normalizeForSearch(query.trim());
  if (q === "") {
    const counts: Record<CommandGroupKey, number> = {
      scenes: 0,
      codex: 0,
      actions: 0,
    };
    return results.filter((r) => {
      if (r.group === "actions") return true;
      counts[r.group] += 1;
      return counts[r.group] <= EMPTY_QUERY_GROUP_LIMIT;
    });
  }
  return results
    .map((result, index) => ({ result, index, rank: rankOf(result, q) }))
    .filter(
      (entry): entry is { result: CommandResult; index: number; rank: number } =>
        entry.rank !== null,
    )
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.result);
}
