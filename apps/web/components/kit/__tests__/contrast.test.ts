/**
 * WCAG-AA contrast regression guard — Task 1 (Design-System Foundation Phase 1).
 *
 * These tests are fully deterministic: they embed the exact hex values that were
 * WCAG-verified before being written into globals.css, and assert 4.5:1 minimum
 * contrast (AA level for normal-weight text).
 *
 * Rationale: freezes the fix against accidental future token edits.  No browser
 * or CSS parsing is involved — the numbers are hardcoded by design.
 */

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// WCAG relative-luminance helper
// ---------------------------------------------------------------------------

/** Convert a single 8-bit channel value [0-255] to linear light. */
function toLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a hex color string, e.g. "#fffdf7". */
function relativeLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * WCAG contrast ratio between a foreground and background hex.
 * Returns a value between 1 (no contrast) and 21 (black on white).
 */
export function contrastRatio(hexFg: string, hexBg: string): number {
  const L1 = relativeLuminance(hexFg);
  const L2 = relativeLuminance(hexBg);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// Token fixture — these MUST match the values written into globals.css.
// ---------------------------------------------------------------------------

const LIGHT = {
  bg: "#f6f1e6",
  surface: "#fffdf7",
  textFaint: "#786a47", // was #a3977c (2.56:1) — FAIL; new value passes AA
  textMuted: "#6e6450", // regression guard
  dangerSolid: "#c2410c",
  dangerSolidFg: "#fffdf7",
};

const DARK = {
  bg: "#1b1712",
  surface: "#252019",
  surfaceMuted: "#2e2820",
  textFaint: "#9b8f6e", // was #857a61 (4.21:1) — FAIL; nudged one step from #9a8e6d to clear surface-muted
  textMuted: "#b5a98b", // regression guard
  dangerSolid: "#b5431f",
  dangerSolidFg: "#fff7f3",
};

const AA_NORMAL = 4.5;

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

describe("WCAG-AA contrast — light theme", () => {
  it("--text-faint on --bg >= 4.5:1", () => {
    const ratio = contrastRatio(LIGHT.textFaint, LIGHT.bg);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("--text-faint on --surface >= 4.5:1", () => {
    const ratio = contrastRatio(LIGHT.textFaint, LIGHT.surface);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("--text-muted on --bg >= 4.5:1 (regression guard)", () => {
    const ratio = contrastRatio(LIGHT.textMuted, LIGHT.bg);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("--danger-solid-fg on --danger-solid >= 4.5:1", () => {
    const ratio = contrastRatio(LIGHT.dangerSolidFg, LIGHT.dangerSolid);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe("WCAG-AA contrast — dark theme", () => {
  it("--text-faint on --bg >= 4.5:1", () => {
    const ratio = contrastRatio(DARK.textFaint, DARK.bg);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("--text-faint on --surface >= 4.5:1", () => {
    const ratio = contrastRatio(DARK.textFaint, DARK.surface);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("--text-faint on --surface-muted >= 4.5:1", () => {
    const ratio = contrastRatio(DARK.textFaint, DARK.surfaceMuted);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("--text-muted on --bg >= 4.5:1 (regression guard)", () => {
    const ratio = contrastRatio(DARK.textMuted, DARK.bg);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("--danger-solid-fg on --danger-solid >= 4.5:1", () => {
    const ratio = contrastRatio(DARK.dangerSolidFg, DARK.dangerSolid);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});
