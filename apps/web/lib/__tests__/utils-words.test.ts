import { describe, expect, it } from "vitest";
import { countWords, formatHu } from "@/lib/utils";

describe("countWords", () => {
  it("counts whitespace-separated words like the backend", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("egy")).toBe(1);
    expect(countWords("egy kettő három")).toBe(3);
    expect(countWords("  egy   kettő \n három ")).toBe(3);
  });
});

describe("formatHu", () => {
  it("groups thousands with a regular space (prototype display)", () => {
    expect(formatHu(0)).toBe("0");
    expect(formatHu(42)).toBe("42");
    expect(formatHu(1482)).toBe("1 482");
    expect(formatHu(1234567)).toBe("1 234 567");
  });
});
