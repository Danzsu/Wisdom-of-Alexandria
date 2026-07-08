import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

/**
 * Unit tests for the landing micro-interaction hooks (magnetic CTAs, hero
 * tilt, parallax glow). jsdom has no layout, so these assert the *behavioural
 * contract* — inline transform strings, listener wiring, rAF scheduling and
 * cleanup — not pixels. `getBoundingClientRect` returns all zeros in jsdom,
 * which conveniently puts every element's centre at (0,0).
 *
 * rAF is replaced with a manual queue so frames advance deterministically via
 * `frame(n)`; matchMedia is stubbed so the reduced-motion preference can be
 * flipped per test.
 */
import {
  PARALLAX_FACTOR,
  TILT_MAX_DEG,
  useHeroTilt,
  useMagnetic,
  useParallaxGlow,
} from "../use-landing-motion";

/* ── deterministic rAF + matchMedia harness ─────────────────────────────── */

let rafQueue: Map<number, FrameRequestCallback>;
let rafSeq: number;
let reducedMotion: boolean;

/** Run `n` animation frames (each frame flushes callbacks queued so far). */
function frame(n = 1) {
  for (let i = 0; i < n; i++) {
    const pending = [...rafQueue.values()];
    rafQueue.clear();
    for (const cb of pending) cb(16 * (i + 1));
  }
}

function pointerMove(el: Element, clientX: number, clientY: number) {
  // jsdom lacks a PointerEvent constructor; a MouseEvent with the pointermove
  // type reaches "pointermove" listeners and carries clientX/clientY.
  el.dispatchEvent(
    new MouseEvent("pointermove", { clientX, clientY, bubbles: true }),
  );
}

function pointerLeave(el: Element) {
  el.dispatchEvent(new MouseEvent("pointerleave", { bubbles: true }));
}

beforeEach(() => {
  rafQueue = new Map();
  rafSeq = 0;
  reducedMotion = false;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafQueue.set(++rafSeq, cb);
    return rafSeq;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafQueue.delete(id);
  });
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: reducedMotion,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/* ── useMagnetic ─────────────────────────────────────────────────────────── */

function MagnetHost() {
  const ref = useMagnetic<HTMLButtonElement>();
  return (
    <button ref={ref} type="button" data-testid="magnet">
      cta
    </button>
  );
}

describe("useMagnetic", () => {
  it("translates toward the pointer on pointermove (rAF-driven lerp)", () => {
    const { getByTestId } = render(<MagnetHost />);
    const el = getByTestId("magnet");

    pointerMove(el, 40, 20);
    expect(rafQueue.size).toBe(1); // exactly one loop scheduled
    frame(1);
    // First lerp step: 20% of (40*0.3, 20*0.45) = (2.4px, 1.8px).
    expect(el.style.transform).toBe("translate(2.4px,1.8px)");
    // Converges toward the full pull without overshooting.
    frame(60);
    expect(el.style.transform).toMatch(/^translate\(1[12]\.\d+px,/);
  });

  it("rAF-throttles: repeated pointermoves reuse the single pending frame", () => {
    const { getByTestId } = render(<MagnetHost />);
    const el = getByTestId("magnet");
    pointerMove(el, 10, 10);
    pointerMove(el, 20, 20);
    pointerMove(el, 30, 30);
    expect(rafQueue.size).toBe(1);
  });

  it("springs back and clears the inline transform on pointerleave", () => {
    const { getByTestId } = render(<MagnetHost />);
    const el = getByTestId("magnet");
    pointerMove(el, 40, 20);
    frame(10);
    expect(el.style.transform).not.toBe("");

    pointerLeave(el);
    frame(80);
    // Settled at rest → the inline transform is removed entirely.
    expect(el.style.transform).toBe("");
  });

  it("is a no-op under prefers-reduced-motion", () => {
    reducedMotion = true;
    const { getByTestId } = render(<MagnetHost />);
    const el = getByTestId("magnet");
    pointerMove(el, 40, 20);
    expect(rafQueue.size).toBe(0);
    frame(5);
    expect(el.style.transform).toBe("");
  });

  it("unmount removes listeners, cancels the pending frame and resets the transform", () => {
    const { getByTestId, unmount } = render(<MagnetHost />);
    const el = getByTestId("magnet") as HTMLElement;
    pointerMove(el, 40, 20);
    frame(1);
    expect(el.style.transform).not.toBe("");
    pointerMove(el, 60, 60); // leave a frame pending across unmount

    unmount();
    expect(rafQueue.size).toBe(0); // pending rAF cancelled
    expect(el.style.transform).toBe(""); // transform reset
    pointerMove(el, 80, 80); // listener gone → nothing scheduled
    expect(rafQueue.size).toBe(0);
  });
});

/* ── useHeroTilt ─────────────────────────────────────────────────────────── */

function TiltHost() {
  const { zoneRef, tiltRef } = useHeroTilt<HTMLElement, HTMLDivElement>();
  return (
    <section ref={zoneRef} data-testid="zone">
      <div ref={tiltRef} data-testid="tilt" />
    </section>
  );
}

/** Parse "rotateY(Xdeg) rotateX(Ydeg)" into numbers. */
function parseTilt(transform: string): { y: number; x: number } {
  const m = /^rotateY\((-?[\d.]+)deg\) rotateX\((-?[\d.]+)deg\)$/.exec(
    transform,
  );
  expect(m, `unexpected tilt transform: "${transform}"`).not.toBeNull();
  return { y: Number(m![1]), x: Number(m![2]) };
}

describe("useHeroTilt", () => {
  it("pointer over the ZONE drives rotateY/rotateX on the tilt element", () => {
    const { getByTestId } = render(<TiltHost />);
    const zone = getByTestId("zone");
    const tilt = getByTestId("tilt");

    // Events land on the zone (the hero section), not the tilt element.
    pointerMove(zone, 100, 50);
    frame(1);
    const first = parseTilt(tilt.style.transform);
    expect(first.y).toBeGreaterThan(0); // pointer right of centre → +rotateY
    expect(first.x).toBeLessThan(0); // pointer below centre → -rotateX
  });

  it(`clamps the tilt to ±${TILT_MAX_DEG}° even for far-away pointers`, () => {
    const { getByTestId } = render(<TiltHost />);
    pointerMove(getByTestId("zone"), 99_999, 99_999);
    frame(120); // let the 0.12 lerp converge
    const settled = parseTilt(getByTestId("tilt").style.transform);
    expect(settled.y).toBeLessThanOrEqual(TILT_MAX_DEG);
    expect(settled.y).toBeGreaterThan(TILT_MAX_DEG - 0.2);
    expect(settled.x).toBeGreaterThanOrEqual(-TILT_MAX_DEG);
    expect(settled.x).toBeLessThan(-(TILT_MAX_DEG - 0.2));
  });

  it("springs back to ~0° on pointerleave", () => {
    const { getByTestId } = render(<TiltHost />);
    const zone = getByTestId("zone");
    pointerMove(zone, 100, 50);
    frame(10);

    pointerLeave(zone);
    frame(120);
    const rest = parseTilt(getByTestId("tilt").style.transform);
    expect(Math.abs(rest.y)).toBeLessThan(0.1);
    expect(Math.abs(rest.x)).toBeLessThan(0.1);
  });

  it("is a no-op under prefers-reduced-motion", () => {
    reducedMotion = true;
    const { getByTestId } = render(<TiltHost />);
    pointerMove(getByTestId("zone"), 100, 50);
    expect(rafQueue.size).toBe(0);
    expect(getByTestId("tilt").style.transform).toBe("");
  });

  it("unmount removes zone listeners, cancels rAF and resets the transform", () => {
    const { getByTestId, unmount } = render(<TiltHost />);
    const zone = getByTestId("zone") as HTMLElement;
    const tilt = getByTestId("tilt") as HTMLElement;
    pointerMove(zone, 100, 50);
    frame(1);
    expect(tilt.style.transform).not.toBe("");
    pointerMove(zone, 200, 100); // leave a frame pending

    unmount();
    expect(rafQueue.size).toBe(0);
    expect(tilt.style.transform).toBe("");
    pointerMove(zone, 300, 150);
    expect(rafQueue.size).toBe(0);
  });
});

/* ── useParallaxGlow ─────────────────────────────────────────────────────── */

function GlowHost() {
  const ref = useParallaxGlow<HTMLDivElement>();
  return <div ref={ref} data-testid="glow" />;
}

function setScrollY(value: number) {
  Object.defineProperty(globalThis, "scrollY", {
    value,
    writable: true,
    configurable: true,
  });
}

describe("useParallaxGlow", () => {
  afterEach(() => setScrollY(0));

  it("applies the initial parallax offset on mount (mid-page reload)", () => {
    setScrollY(150);
    const { getByTestId } = render(<GlowHost />);
    expect(getByTestId("glow").style.transform).toBe(
      `translate3d(0,${(150 * PARALLAX_FACTOR).toFixed(1)}px,0)`,
    );
  });

  it("translates by a fraction of scrollY on scroll (rAF-throttled)", () => {
    setScrollY(0);
    const { getByTestId } = render(<GlowHost />);
    const glow = getByTestId("glow");

    setScrollY(300);
    globalThis.dispatchEvent(new Event("scroll"));
    globalThis.dispatchEvent(new Event("scroll")); // burst → single frame
    expect(rafQueue.size).toBe(1);
    frame(1);
    expect(glow.style.transform).toBe(
      `translate3d(0,${(300 * PARALLAX_FACTOR).toFixed(1)}px,0)`,
    );
  });

  it("is a no-op under prefers-reduced-motion", () => {
    reducedMotion = true;
    setScrollY(200);
    const { getByTestId } = render(<GlowHost />);
    const glow = getByTestId("glow");
    expect(glow.style.transform).toBe("");
    globalThis.dispatchEvent(new Event("scroll"));
    expect(rafQueue.size).toBe(0);
  });

  it("unmount removes the scroll listener, cancels rAF and resets the transform", () => {
    const { getByTestId, unmount } = render(<GlowHost />);
    const glow = getByTestId("glow") as HTMLElement;
    setScrollY(120);
    globalThis.dispatchEvent(new Event("scroll")); // pending frame across unmount

    unmount();
    expect(rafQueue.size).toBe(0);
    expect(glow.style.transform).toBe("");
    globalThis.dispatchEvent(new Event("scroll"));
    expect(rafQueue.size).toBe(0);
  });
});
