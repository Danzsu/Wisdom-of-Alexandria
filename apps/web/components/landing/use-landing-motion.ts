"use client";

import { useEffect, useRef } from "react";

/**
 * Landing-page micro-interaction hooks, ported from the Claude Design canvas
 * (`.superpowers/sdd/design/Alexandria.latest.html` — `setupMagnetic`,
 * `setupTilt`, `setupParallax`):
 *
 *   - {@link useMagnetic} — CTAs gently follow the pointer and spring back.
 *   - {@link useHeroTilt} — pointer over the hero section 3D-tilts the
 *     floating editor mock (±7°).
 *   - {@link useParallaxGlow} — the hero's radial glow drifts at a fraction
 *     of the scroll speed.
 *
 * Shared contract:
 *   - **Reduced motion → hard no-op.** The preference is checked on mount and
 *     no listener is ever attached (CSS media rules cannot stop JS-driven
 *     transforms, so the gate lives here, mirroring the mock's `reduced()`).
 *   - **rAF-throttled.** Pointer/scroll handlers only record targets; a single
 *     rAF loop per element writes `style.transform` and stops when settled.
 *   - **Clean unmount.** Listeners are removed, any pending frame cancelled
 *     and the inline transform reset.
 */

/** True when the user asks for reduced motion — every hook here is then inert. */
function prefersReducedMotion(): boolean {
  try {
    return globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** Max hero tilt, in degrees (the design's `rotateY(±7°)/rotateX(∓7°)`). */
export const TILT_MAX_DEG = 7;

/** Fraction of `scrollY` the hero glow drifts by (subtle, sub-scroll speed). */
export const PARALLAX_FACTOR = 0.22;

/**
 * Magnetic CTA: while the pointer is over the element it translates a few px
 * toward the cursor (30% of the x-offset, 45% of the y-offset from centre,
 * per the design mock) via a 0.2-lerp rAF loop, and springs back to rest on
 * pointerleave. At rest the inline transform is removed entirely so CSS
 * hover/active transforms regain control.
 */
export function useMagnetic<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    let raf: number | null = null;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    const loop = () => {
      cx += (tx - cx) * 0.2;
      cy += (ty - cy) * 0.2;
      el.style.transform =
        tx === 0 && ty === 0 && Math.abs(cx) < 0.15 && Math.abs(cy) < 0.15
          ? ""
          : `translate(${cx.toFixed(1)}px,${cy.toFixed(1)}px)`;
      raf =
        Math.abs(tx - cx) > 0.1 || Math.abs(ty - cy) > 0.1
          ? requestAnimationFrame(loop)
          : null;
    };
    const onMove = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = (ev.clientX - (r.left + r.width / 2)) * 0.3;
      ty = (ev.clientY - (r.top + r.height / 2)) * 0.45;
      raf ??= requestAnimationFrame(loop);
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      raf ??= requestAnimationFrame(loop);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (raf !== null) cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, []);

  return ref;
}

/**
 * Hero tilt: pointer movement over the *zone* (the hero section) rotates the
 * *tilt* element (the floating editor mock) by up to ±{@link TILT_MAX_DEG}°
 * — `rotateY` follows the horizontal offset, `rotateX` opposes the vertical —
 * through a 0.12-lerp rAF loop; the offsets are clamped to [-1, 1] so far-away
 * pointers cannot over-rotate. On pointerleave it eases back to 0°. The zone
 * (or its grid) needs CSS `perspective` and the tilt element
 * `transform-style: preserve-3d` for depth.
 */
export function useHeroTilt<Z extends HTMLElement, T extends HTMLElement>() {
  const zoneRef = useRef<Z | null>(null);
  const tiltRef = useRef<T | null>(null);

  useEffect(() => {
    const zone = zoneRef.current;
    const el = tiltRef.current;
    if (!zone || !el || prefersReducedMotion()) return;

    let raf: number | null = null;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;

    const loop = () => {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      el.style.transform = `rotateY(${(cx * TILT_MAX_DEG).toFixed(2)}deg) rotateX(${(-cy * TILT_MAX_DEG).toFixed(2)}deg)`;
      raf =
        Math.abs(tx - cx) > 0.004 || Math.abs(ty - cy) > 0.004
          ? requestAnimationFrame(loop)
          : null;
    };
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const onMove = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      // `|| 1` guards the no-layout case (jsdom / display:none) against NaN.
      tx = clamp((ev.clientX - (r.left + r.width / 2)) / (r.width / 2 || 1));
      ty = clamp((ev.clientY - (r.top + r.height / 2)) / (r.height / 2 || 1));
      raf ??= requestAnimationFrame(loop);
    };
    const onLeave = () => {
      tx = 0;
      ty = 0;
      raf ??= requestAnimationFrame(loop);
    };

    zone.addEventListener("pointermove", onMove);
    zone.addEventListener("pointerleave", onLeave);
    return () => {
      zone.removeEventListener("pointermove", onMove);
      zone.removeEventListener("pointerleave", onLeave);
      if (raf !== null) cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, []);

  return { zoneRef, tiltRef };
}

/**
 * Scroll parallax for the hero glow: the element translates down by
 * {@link PARALLAX_FACTOR} × `scrollY`, so the glow appears to scroll slower
 * than the page. One passive scroll listener, one rAF write per frame; the
 * offset is also applied once on mount so a mid-page reload starts correct.
 * Pair with `will-change: transform` on the element.
 */
export function useParallaxGlow<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;

    let raf: number | null = null;
    const apply = () => {
      raf = null;
      el.style.transform = `translate3d(0,${(globalThis.scrollY * PARALLAX_FACTOR).toFixed(1)}px,0)`;
    };
    const onScroll = () => {
      raf ??= requestAnimationFrame(apply);
    };

    apply();
    globalThis.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      globalThis.removeEventListener("scroll", onScroll);
      if (raf !== null) cancelAnimationFrame(raf);
      el.style.transform = "";
    };
  }, []);

  return ref;
}
