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
