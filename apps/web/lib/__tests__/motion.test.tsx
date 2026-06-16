import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock framer-motion's useReducedMotion so we can flip the preference per test
// without touching matchMedia. The hook under test must independently honour it.
const reducedMotion = { value: false as boolean };
vi.mock("framer-motion", () => ({
  useReducedMotion: () => reducedMotion.value,
}));

import {
  useCalmMotion,
  EASE_OUT_EXPO,
  EASE_OUT_QUINT,
  STAGGER_MAX_ITEMS,
  STAGGER_STEP,
} from "@/lib/motion";

describe("lib/motion easing curves", () => {
  it("are ease-out only — control points stay within [0,1] (no bounce/overshoot)", () => {
    for (const curve of [EASE_OUT_EXPO, EASE_OUT_QUINT]) {
      for (const point of curve) {
        expect(point).toBeGreaterThanOrEqual(0);
        expect(point).toBeLessThanOrEqual(1);
      }
      // Ends settling AT the target (final y = 1), never past it.
      expect(curve[3]).toBe(1);
    }
  });
});

describe("useCalmMotion (animated)", () => {
  it("returns animated variants with a transform+opacity entrance and an exit", () => {
    reducedMotion.value = false;
    const { result } = renderHook(() => useCalmMotion());

    expect(result.current.reduced).toBe(false);
    // Hidden state is offset + transparent; visible settles to the target.
    expect(result.current.fadeInUp.hidden).toMatchObject({ opacity: 0 });
    expect(result.current.fadeInUp.visible).toMatchObject({ opacity: 1 });
    expect(result.current.fadeInUp.exit).toBeDefined();
    expect(result.current.staggerContainer.visible).toBeDefined();
    expect(result.current.staggerChild.hidden).toMatchObject({ opacity: 0 });
  });

  it("staggers child delay and caps it for long lists", () => {
    reducedMotion.value = false;
    const { result } = renderHook(() => useCalmMotion());

    expect(result.current.childDelay(0)).toBe(0);
    expect(result.current.childDelay(3)).toBeCloseTo(3 * STAGGER_STEP);
    // Past the cap, the delay plateaus so a big list isn't slow.
    expect(result.current.childDelay(99)).toBeCloseTo(
      STAGGER_MAX_ITEMS * STAGGER_STEP,
    );
  });
});

describe("useCalmMotion (reduced motion)", () => {
  it("short-circuits to no-op variants that render the final visible state", () => {
    reducedMotion.value = true;
    const { result } = renderHook(() => useCalmMotion());

    expect(result.current.reduced).toBe(true);
    // No-op shape: visible (opacity 1) in EVERY phase, zero-duration transitions.
    expect(result.current.fadeInUp.hidden).toMatchObject({ opacity: 1 });
    expect(result.current.fadeInUp.visible).toMatchObject({
      opacity: 1,
      transition: { duration: 0 },
    });
    expect(result.current.staggerChild.hidden).toMatchObject({ opacity: 1 });
    // Stagger collapses to zero so nothing is sequenced.
    expect(result.current.childDelay(5)).toBe(0);
    expect(result.current.childDelay(99)).toBe(0);
    expect(result.current.transition).toMatchObject({ duration: 0 });
  });
});
