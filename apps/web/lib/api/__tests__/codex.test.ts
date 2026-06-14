import { describe, expect, it } from "vitest";
import {
  contentMentions,
  countMentions,
  decodeTags,
  encodeTags,
  isControlTag,
  mentionNeedles,
  parseAliasInput,
  type DecodedTags,
} from "@/lib/api/codex";

/**
 * Contract tests for the Codex tags codec. The codec folds aliases + story role
 * + name-tracking opt-out into the backend's single free-form `tags` list using
 * a `__woa:` sentinel namespace, so a real user label is NEVER misclassified as
 * structured data.
 *
 * NOTE (collision test, see below): the "alias:foo" / "role:X" / "tracking:off"
 * cases below FAIL against the OLD bare-prefix codec (it would steal those into
 * aliases/role/trackingOff) and PASS under the namespaced codec.
 */

describe("decodeTags", () => {
  it("decodes namespaced alias / role / tracking keys", () => {
    const decoded = decodeTags([
      "__woa:alias=Lené",
      "__woa:role=Hős",
      "__woa:tracking=off",
      "főszereplő",
    ]);
    expect(decoded.aliases).toEqual(["Lené"]);
    expect(decoded.role).toBe("Hős");
    expect(decoded.trackingOff).toBe(true);
    expect(decoded.labels).toEqual(["főszereplő"]);
  });

  it("never leaks an internal sentinel key into labels", () => {
    const decoded = decodeTags([
      "__woa:alias=Lené",
      "__woa:role=Hős",
      "__woa:tracking=off",
      "__woa:unknown=whatever",
      "valódi címke",
    ]);
    for (const label of decoded.labels) {
      expect(isControlTag(label)).toBe(false);
    }
    expect(decoded.labels).toEqual(["valódi címke"]);
  });

  // --- COLLISION GUARD (fails on the old bare-prefix codec) -----------------
  it("treats a user tag that LOOKS like a control key as a plain label", () => {
    const decoded = decodeTags(["alias:foo", "role:X", "tracking:off"]);
    // None of these are misclassified: they are ordinary user labels now.
    expect(decoded.aliases).toEqual([]);
    expect(decoded.role).toBeNull();
    expect(decoded.trackingOff).toBe(false);
    expect(decoded.labels).toEqual(["alias:foo", "role:X", "tracking:off"]);
  });

  it("dedupes aliases case-insensitively, keeping first spelling", () => {
    const decoded = decodeTags([
      "__woa:alias=Lené",
      "__woa:alias=lené",
      "__woa:alias=Theón",
    ]);
    expect(decoded.aliases).toEqual(["Lené", "Theón"]);
  });

  it("keeps the LAST role when multiple role keys are present (no crash)", () => {
    const decoded = decodeTags([
      "__woa:role=Mellékszereplő",
      "__woa:role=Antagonista",
    ]);
    expect(decoded.role).toBe("Antagonista");
  });

  it("skips empty / whitespace-only alias and role values", () => {
    const decoded = decodeTags([
      "__woa:alias=",
      "__woa:alias=   ",
      "__woa:alias=  Lené  ",
      "__woa:role=   ",
      "   ",
    ]);
    expect(decoded.aliases).toEqual(["Lené"]);
    expect(decoded.role).toBeNull();
    expect(decoded.labels).toEqual([]);
  });

  it("preserves user-label ordering", () => {
    const decoded = decodeTags([
      "zebra",
      "__woa:alias=Lené",
      "alma",
      "körte",
    ]);
    expect(decoded.labels).toEqual(["zebra", "alma", "körte"]);
  });
});

describe("encodeTags", () => {
  it("rebuilds the flat list, dropping empties and deduping aliases", () => {
    const decoded: DecodedTags = {
      aliases: ["Lené", "lené", "  ", "Theón"],
      role: " Hős ",
      labels: ["főszereplő", "  "],
      trackingOff: true,
    };
    expect(encodeTags(decoded)).toEqual([
      "__woa:alias=Lené",
      "__woa:alias=Theón",
      "__woa:role=Hős",
      "főszereplő",
      "__woa:tracking=off",
    ]);
  });

  it("emits no role key when role is null/blank", () => {
    expect(encodeTags({ aliases: [], role: null, labels: [], trackingOff: false }))
      .toEqual([]);
    expect(encodeTags({ aliases: [], role: "   ", labels: [], trackingOff: false }))
      .toEqual([]);
  });

  it("never re-encodes a label that is itself a sentinel key", () => {
    const out = encodeTags({
      aliases: [],
      role: null,
      labels: ["__woa:alias=sneaky", "rendes"],
      trackingOff: false,
    });
    expect(out).toEqual(["rendes"]);
  });
});

describe("encode ∘ decode round-trip", () => {
  it("is idempotent for already-encoded input", () => {
    const original = [
      "__woa:alias=Lené",
      "__woa:role=Hős",
      "főszereplő",
      "__woa:tracking=off",
    ];
    const once = encodeTags(decodeTags(original));
    const twice = encodeTags(decodeTags(once));
    expect(once).toEqual(original);
    expect(twice).toEqual(once);
  });

  it("round-trips a mix of structured + collision-looking labels", () => {
    const original = ["__woa:alias=Lené", "alias:not-structured", "role:nope"];
    const once = encodeTags(decodeTags(original));
    const twice = encodeTags(decodeTags(once));
    expect(once).toEqual(original);
    expect(twice).toEqual(once);
  });
});

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
