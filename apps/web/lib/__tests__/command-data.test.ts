/**
 * Unit tests for the command-palette search model (gap-fix #1 — replaced the
 * static demo list + substring `filterCommands` with real result builders and
 * a ranked, accent-insensitive `searchCommands`).
 */
import { describe, expect, it } from "vitest";
import {
  buildActionResults,
  buildCodexResults,
  buildSceneResults,
  normalizeForSearch,
  searchCommands,
  EMPTY_QUERY_GROUP_LIMIT,
  type CommandResult,
} from "../command-data";
import { routes } from "../routes";
import { hu } from "../i18n/hu";
import type { ChapterWithScenes } from "../api/hooks";
import type { CodexEntryRead } from "../api/types";
import {
  CHAPTER_ONE,
  CHAPTER_TWO,
  FAROSZ_BOOK,
  FAROSZ_CODEX,
  SCENE_ACTIVE,
  SCENE_FIRST,
} from "@/test/msw/fixtures";

const TREE: ChapterWithScenes[] = [
  { ...CHAPTER_ONE, scenes: [SCENE_FIRST] },
  { ...CHAPTER_TWO, scenes: [SCENE_ACTIVE] },
];

describe("build*Results", () => {
  it("scene results carry the scene title, ITS chapter as meta, and the real Write route", () => {
    const results = buildSceneResults(TREE, FAROSZ_BOOK.id);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      group: "scenes",
      label: SCENE_FIRST.title,
      meta: CHAPTER_ONE.title,
      href: routes.scene(FAROSZ_BOOK.id, SCENE_FIRST.id),
    });
    expect(results[1].href).toBe(routes.scene(FAROSZ_BOOK.id, SCENE_ACTIVE.id));
  });

  it("codex results link to the codex route with the entry preselected (?entry=)", () => {
    const results = buildCodexResults(
      FAROSZ_CODEX as CodexEntryRead[],
      FAROSZ_BOOK.id,
    );
    expect(results[0]).toMatchObject({
      group: "codex",
      label: "Szelene",
      meta: hu.codex.typeLabel.character,
      href: `${routes.book(FAROSZ_BOOK.id, "codex")}?entry=codex-szelene`,
    });
  });

  it("actions include the book-scoped export only inside a book", () => {
    const inBook = buildActionResults(FAROSZ_BOOK.id);
    expect(inBook.map((a) => a.id)).toEqual([
      "action-export",
      "action-theme",
      "action-shortcuts",
      "action-how-it-works",
    ]);
    expect(inBook[0].href).toBe(routes.book(FAROSZ_BOOK.id, "export"));

    const outside = buildActionResults(null);
    expect(outside.some((a) => a.id === "action-export")).toBe(false);
    expect(outside).toHaveLength(3);
  });
});

describe("searchCommands", () => {
  const results: CommandResult[] = [
    { id: "a", group: "scenes", label: "Végső jelenet" },
    { id: "b", group: "scenes", label: "Jelenet a kikötőben" },
    { id: "c", group: "scenes", label: "Harmadik", meta: "jelenet-jegyzet" },
    { id: "act", group: "actions", label: "Téma váltása" },
  ];

  it("returns the capped default for an empty/blank query", () => {
    const many: CommandResult[] = Array.from({ length: 9 }, (_, i) => ({
      id: `s${i}`,
      group: "scenes" as const,
      label: `Jelenet ${i}`,
    }));
    const all = [...many, { id: "act", group: "actions" as const, label: "X" }];
    const defaults = searchCommands(all, "");
    // Scenes are capped; actions always survive.
    expect(
      defaults.filter((r) => r.group === "scenes"),
    ).toHaveLength(EMPTY_QUERY_GROUP_LIMIT);
    expect(defaults.some((r) => r.id === "act")).toBe(true);
    expect(searchCommands(all, "   ").length).toBe(defaults.length);
  });

  it("ranks label prefix > label substring > meta substring, stable on ties", () => {
    expect(searchCommands(results, "jelenet").map((r) => r.id)).toEqual([
      "b",
      "a",
      "c",
    ]);
  });

  it("matches case- and accent-insensitively", () => {
    expect(searchCommands(results, "VÉGSŐ").map((r) => r.id)).toEqual(["a"]);
    // Accent-stripped query finds the accented label.
    expect(searchCommands(results, "vegso").map((r) => r.id)).toEqual(["a"]);
    expect(normalizeForSearch("Műszak Árnyék")).toBe("muszak arnyek");
  });

  it("returns an empty list when nothing matches", () => {
    expect(searchCommands(results, "zzzznomatch")).toHaveLength(0);
  });
});
