import { describe, expect, it } from "vitest";
import {
  contentMentions,
  countMentions,
  mentionNeedles,
  parseAliasInput,
} from "@/lib/api/codex";

/**
 * Unit tests for the Codex helpers.
 *
 * P1.4 added dedicated `aliases` + `role` columns to the backend Codex card, so
 * the old `__woa:` namespaced tags codec (decodeTags / encodeTags / isControlTag)
 * was REMOVED — aliases + role now come from / go to their own fields. What
 * remains here is the comma-separated alias-input parser and the manuscript
 * mention-scan helpers (title + aliases → needles → scene counts).
 */

describe("parseAliasInput", () => {
  it("splits on commas, trims, and dedupes case-insensitively", () => {
    expect(parseAliasInput("a mester, Theónt , a mester,  ")).toEqual([
      "a mester",
      "Theónt",
    ]);
  });

  it("returns an empty list for blank input", () => {
    expect(parseAliasInput("   ,  , ")).toEqual([]);
  });

  it("keeps the first spelling when a duplicate differs only in case", () => {
    expect(parseAliasInput("Lené, lené, LENÉ")).toEqual(["Lené"]);
  });
});

describe("mention scan helpers", () => {
  it("builds needles from title + aliases, skipping blanks", () => {
    expect(mentionNeedles("Szelene", ["Lené", "  ", ""])).toEqual([
      "Szelene",
      "Lené",
    ]);
  });

  it("contentMentions is case-insensitive and null-safe", () => {
    expect(contentMentions("Szelene a tekercsek közé hajolt", ["szelene"])).toBe(
      true,
    );
    expect(contentMentions(null, ["Szelene"])).toBe(false);
    expect(contentMentions("semmi", ["Szelene"])).toBe(false);
  });

  it("counts scenes that mention any needle across the tree", () => {
    const chapters = [
      { scenes: [{ content: "Szelene belépett." }, { content: "Üres." }] },
      { scenes: [{ content: "Lené suttogott." }] },
    ];
    expect(countMentions(chapters, ["Szelene", "Lené"])).toBe(2);
    expect(countMentions(chapters, [])).toBe(0);
  });
});
