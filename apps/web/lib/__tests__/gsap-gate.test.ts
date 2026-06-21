/**
 * Unit tests for the GSAP animation gate (`canAnimateGsap`). These EXERCISE the
 * reduced-motion (`matchMedia`) branch directly — the component call sites pass
 * `process.env.NODE_ENV === "test"` so under vitest the gate always short-circuits
 * to `false` before reaching `matchMedia`; here we pass `isTestEnv = false`
 * explicitly so the reduced-motion logic is actually evaluated and provable.
 */
import { describe, expect, it, vi } from "vitest";
import { canAnimateGsap } from "../gsap-gate";

/** Build a `matchMedia` stub whose reduced-motion query reports `reduced`. */
function matchMediaStub(reduced: boolean) {
  return vi.fn((query: string) => ({
    matches: query === "(prefers-reduced-motion: reduce)" ? reduced : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as (query: string) => MediaQueryList;
}

describe("canAnimateGsap", () => {
  it("returns false with no window (SSR)", () => {
    expect(canAnimateGsap(false, false, matchMediaStub(false))).toBe(false);
  });

  it("returns false under the test env even when motion is allowed", () => {
    // This is the production short-circuit the components rely on.
    expect(canAnimateGsap(true, true, matchMediaStub(false))).toBe(false);
  });

  it("returns false when matchMedia is unavailable", () => {
    expect(canAnimateGsap(true, false, undefined)).toBe(false);
  });

  it("returns FALSE under prefers-reduced-motion (the gate's teeth)", () => {
    // The branch the test env normally hides: a real browser, motion reduced.
    expect(canAnimateGsap(true, false, matchMediaStub(true))).toBe(false);
  });

  it("returns TRUE in a real browser with motion allowed", () => {
    expect(canAnimateGsap(true, false, matchMediaStub(false))).toBe(true);
  });
});
