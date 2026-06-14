import { describe, expect, it } from "vitest";
import {
  filenameFromContentDisposition,
  markdownFilename,
  slugify,
} from "@/lib/slugify";

describe("slugify (Hungarian ASCII-fold)", () => {
  it("folds the book title to an ASCII slug", () => {
    // "A Fárosz őrzője" → a_farosz_orzoje (á→a, ő→o, ö→o, é→e), lowercase.
    expect(slugify("A Fárosz őrzője")).toBe("a_farosz_orzoje");
  });

  it("maps every Hungarian accented vowel to its base letter", () => {
    expect(slugify("áéíóöőúüű")).toBe("aeiooouuu");
    expect(slugify("ÁÉÍÓÖŐÚÜŰ")).toBe("aeiooouuu");
  });

  it("collapses whitespace runs to a single underscore", () => {
    expect(slugify("Az   alexandriai   hajnal")).toBe("az_alexandriai_hajnal");
  });

  it("strips punctuation and non-ascii, trims underscores", () => {
    expect(slugify("  „Idézet”: a vég!  ")).toBe("idezet_a_veg");
    expect(slugify("résztvevők (2026)")).toBe("resztvevok_2026");
  });

  it("returns an empty string when nothing survives folding", () => {
    expect(slugify("———")).toBe("");
    expect(slugify("   ")).toBe("");
  });
});

describe("markdownFilename", () => {
  it("appends .md to the folded slug", () => {
    expect(markdownFilename("A Fárosz őrzője")).toBe("a_farosz_orzoje.md");
  });

  it("falls back to export.md when the title folds to nothing", () => {
    expect(markdownFilename("———")).toBe("export.md");
  });
});

describe("filenameFromContentDisposition", () => {
  it("prefers the RFC 5987 filename* (UTF-8) form", () => {
    const header =
      "attachment; filename=\"a_farosz_orzoje.md\"; " +
      "filename*=UTF-8''A%20F%C3%A1rosz%20%C5%91rz%C5%91je.md";
    expect(filenameFromContentDisposition(header)).toBe("A Fárosz őrzője.md");
  });

  it("falls back to the plain filename when filename* is absent", () => {
    expect(
      filenameFromContentDisposition('attachment; filename="book.md"'),
    ).toBe("book.md");
  });

  it("returns null for a header with no filename token", () => {
    expect(filenameFromContentDisposition("attachment")).toBeNull();
    expect(filenameFromContentDisposition(null)).toBeNull();
  });
});
