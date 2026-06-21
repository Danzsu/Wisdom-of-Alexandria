import { describe, expect, it } from "vitest";
import { diffWords } from "@/lib/diff";

/** Reassemble a segment array back into its source string. */
const join = (segs: { text: string }[]) => segs.map((s) => s.text).join("");

describe("diffWords", () => {
  it("is loss-free: each side reassembles to its source text", () => {
    const before = "A vihar közeledett, az ég elsötétült.";
    const after = "A vihar gyorsan közeledett, az ég teljesen elsötétült.";
    const { original, suggestion } = diffWords(before, after);
    expect(join(original)).toBe(before);
    expect(join(suggestion)).toBe(after);
  });

  it("marks added words as additions on the suggestion side only", () => {
    const { original, suggestion } = diffWords("a c", "a b c");
    // "b" is new → an addition on suggestion, absent from original.
    expect(suggestion.some((s) => s.type === "addition" && s.text.includes("b"))).toBe(true);
    expect(original.some((s) => s.type === "addition")).toBe(false);
  });

  it("marks removed words as deletions on the original side only", () => {
    const { original, suggestion } = diffWords("a b c", "a c");
    expect(original.some((s) => s.type === "deletion" && s.text.includes("b"))).toBe(true);
    expect(suggestion.some((s) => s.type === "deletion")).toBe(false);
  });

  it("identical text is all-equal (no add/del)", () => {
    const { original, suggestion } = diffWords("ugyanaz", "ugyanaz");
    expect(original.every((s) => s.type === "equal")).toBe(true);
    expect(suggestion.every((s) => s.type === "equal")).toBe(true);
  });

  it("handles empty before (full addition) and empty after (full deletion)", () => {
    expect(diffWords("", "új").suggestion.some((s) => s.type === "addition")).toBe(true);
    expect(diffWords("régi", "").original.some((s) => s.type === "deletion")).toBe(true);
  });
});
