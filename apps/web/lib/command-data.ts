import { routes, DEMO_BOOK_ID, DEMO_SCENE_ID } from "./routes";

/** Command-palette result groups. Static placeholder data for M2 (M3+ wires real search). */
export type CommandGroupKey = "scenes" | "codex" | "actions";

export interface CommandResult {
  id: string;
  group: CommandGroupKey;
  /** Primary label (matched against the query). */
  label: string;
  /** Secondary label shown to the right (also searched). */
  meta?: string;
  /** Destination route for navigable results. */
  href?: string;
  /** Non-navigable action kind (handled by the palette). */
  action?: "export" | "theme";
}

/** Static placeholder results (verbatim copy from the prototype). */
export const COMMAND_RESULTS: CommandResult[] = [
  {
    id: "scene-3",
    group: "scenes",
    label: "3. jelenet — Rejtett jelek",
    meta: "II. fejezet",
    href: routes.scene(DEMO_BOOK_ID, DEMO_SCENE_ID),
  },
  {
    id: "codex-szelene",
    group: "codex",
    label: "Szelene",
    meta: "karakter · 23 megemlítés",
    href: routes.book(DEMO_BOOK_ID, "codex"),
  },
  {
    id: "action-export",
    group: "actions",
    label: "Exportálás…",
    href: routes.book(DEMO_BOOK_ID, "export"),
  },
  {
    id: "action-theme",
    group: "actions",
    label: "Téma váltása",
    action: "theme",
  },
];

/**
 * Case-insensitive, accent-aware-enough substring filter over label + meta.
 * An empty query returns everything (the palette's initial state).
 */
export function filterCommands(
  results: CommandResult[],
  query: string,
): CommandResult[] {
  const q = query.trim().toLowerCase();
  if (q === "") return results;
  return results.filter((r) => {
    const haystack = `${r.label} ${r.meta ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });
}
