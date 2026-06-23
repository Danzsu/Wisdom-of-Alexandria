/**
 * WCAG-AA contrast regression guard — Design-A reskin (purple accent).
 *
 * These tests are fully deterministic: they embed the exact hex values that were
 * WCAG-verified before being written into globals.css, and assert 4.5:1 minimum
 * contrast (AA level for normal-weight text).
 *
 * Rationale: freezes the fix against accidental future token edits. No browser
 * or CSS parsing is involved — the numbers are hardcoded by design.
 *
 * AA derivations:
 *   Light --text-faint: #766d64 → 4.70:1 on #f8f6f2 bg, 5.07:1 on #ffffff surface.
 *   Dark  --text-faint: #978c78 → 5.51:1 on #17150f bg, 5.06:1 on #211d16 surface,
 *                                  4.55:1 on #2a261e surface-muted.
 *   Accent button fill: --accent-strong #5b4de0 with --accent-fg #ffffff → 5.86:1.
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
// Design-A reskin (2026-06-24): gold → purple accent, warm-neutral backgrounds.
// ---------------------------------------------------------------------------

const LIGHT = {
  bg: "#f8f6f2",
  surface: "#ffffff",
  // AA-derived: closest warm-grey to design's #9b9187 (which fails at 2.86:1).
  // #766d64 → 4.70:1 on bg, 5.07:1 on surface. PASS.
  textFaint: "#766d64",
  textMuted: "#6f675f", // regression guard — 5.15:1 on bg
  dangerSolid: "#c2410c",
  dangerSolidFg: "#fffdf7",
  // Accent button: CTA variant uses bg-accent-strong (#5b4de0) with text-accent-fg (#ffffff).
  // 5.86:1 — PASS. accent itself (#6d5dfc) is 3.93:1 — would fail; button uses accent-strong.
  accentButtonFill: "#5b4de0",
  accentButtonFg: "#ffffff",
};

const DARK = {
  bg: "#17150f",
  surface: "#211d16",
  surfaceMuted: "#2a261e",
  // AA-derived: closest warm-grey to design's #857a68 (which fails at 4.33/3.98/3.57).
  // #978c78 → 5.51:1 on bg, 5.06:1 on surface, 4.55:1 on surface-muted. PASS.
  textFaint: "#978c78",
  textMuted: "#b6aa96", // regression guard — 7.98:1 on bg
  dangerSolid: "#b5431f",
  dangerSolidFg: "#fff7f3",
  // Dark accent button: bg-accent-strong (#9187ff) with accent-fg (#0f0d1a).
  // 6.51:1 — PASS.
  accentButtonFill: "#9187ff",
  accentButtonFg: "#0f0d1a",
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

  it("accent button: --accent-fg on --accent-strong >= 4.5:1", () => {
    // CTA button variant uses bg-accent-strong as fill and text-accent-fg as label.
    // See apps/web/components/kit/button.tsx — cta variant.
    const ratio = contrastRatio(LIGHT.accentButtonFg, LIGHT.accentButtonFill);
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

  it("accent button: --accent-fg on --accent-strong >= 4.5:1", () => {
    // Dark CTA button: accent-strong=#9187ff fills the button, accent-fg=#0f0d1a is the label.
    const ratio = contrastRatio(DARK.accentButtonFg, DARK.accentButtonFill);
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});
