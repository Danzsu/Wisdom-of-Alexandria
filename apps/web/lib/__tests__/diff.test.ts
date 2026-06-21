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

  it("degrades huge inputs to a whole-replacement diff (no O(n*m) blowup)", () => {
    // > MAX_DIFF_CHARS combined → must NOT build the LCS matrix; returns a single
    // deletion + single addition, still loss-free, and returns fast.
    const before = "a ".repeat(120_000); // ~240k chars
    const after = "b ".repeat(120_000);
    const start = Date.now();
    const { original, suggestion } = diffWords(before, after);
    expect(Date.now() - start).toBeLessThan(1000); // would hang if LCS ran
    expect(original).toEqual([{ type: "deletion", text: before }]);
    expect(suggestion).toEqual([{ type: "addition", text: after }]);
    expect(join(original)).toBe(before);
    expect(join(suggestion)).toBe(after);
  });
});
