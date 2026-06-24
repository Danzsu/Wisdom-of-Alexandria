"use client";

import { useEffect, useRef } from "react";

/**
 * Drifting gold embers behind the landing hero — a cheap, decorative `<canvas>`
 * layer. Faithful to the design's `.woa-embers` backdrop: a few dozen slow,
 * upward-rising motes tinted with the gold tokens, low opacity.
 *
 * Constraints (kept deliberately small):
 *   - ≤ {@link MAX_PARTICLES} particles, one `requestAnimationFrame` loop.
 *   - `pointer-events:none` so it never intercepts clicks.
 *   - sized to its parent via ResizeObserver, DPR-aware.
 *   - **No-op under `prefers-reduced-motion`** — the loop never starts (the
 *     global CSS rule cannot pause a JS rAF, so we gate it here per the brief).
 *
 * Reads the live `--gold` / `--gold-deep` CSS variables so it follows the
 * theme (light/dark) automatically.
 */
const MAX_PARTICLES = 36;

interface Ember {
  x: number;
  y: number;
  r: number;
  /** Upward speed (px/sec). */
  vy: number;
  /** Horizontal sway amplitude (px) + phase. */
  sway: number;
  phase: number;
  /** Base alpha for this mote. */
  alpha: number;
  /** Twinkle speed. */
  tw: number;
}

export function EmbersCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Respect reduced motion: render nothing, never start the loop.
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const parent = canvas.parentElement ?? canvas;
    let width = 0;
    let height = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let embers: Ember[] = [];

    // Resolve the gold tokens from the document root (the theme attribute
    // `data-woa` lives on <html>), so a light/dark switch is picked up
    // reliably. The concrete hex fallbacks are a last resort only — a canvas
    // 2D context cannot consume CSS vars directly, so we must read a concrete
    // colour; we re-resolve on theme change (see the MutationObserver below).
    function goldColors(): { core: string; deep: string } {
      const styles = getComputedStyle(document.documentElement);
      return {
        core: styles.getPropertyValue("--gold").trim() || "#b8893f",
        deep: styles.getPropertyValue("--gold-deep").trim() || "#8a6a2e",
      };
    }
    let colors = goldColors();

    /**
     * Pre-render ONE soft ember into an offscreen sprite (a radial glow plus a
     * crisp core), so the rAF loop only `drawImage`s it per mote — no
     * per-frame gradient allocation (which would cause GC jitter on mobile).
     * The sprite is rebuilt only when the theme colour changes.
     *
     * Geometry: the glow fills the sprite to `SPRITE_GLOW_R`; the core sits at
     * 1/3 of that — matching the original `r*3` glow / `r` core ratio. A mote's
     * `r` maps to a draw scale of `(r * 3) / SPRITE_GLOW_R`.
     */
    const SPRITE_GLOW_R = 24; // px (intrinsic, pre-DPR)
    const SPRITE_SIZE = SPRITE_GLOW_R * 2;
    let sprite: HTMLCanvasElement | null = null;
    let spriteDirty = true;

    function buildSprite(): HTMLCanvasElement | null {
      const off = document.createElement("canvas");
      off.width = Math.round(SPRITE_SIZE * dpr);
      off.height = Math.round(SPRITE_SIZE * dpr);
      const octx = off.getContext("2d");
      if (!octx) return null;
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cx = SPRITE_GLOW_R;
      const cy = SPRITE_GLOW_R;
      // Soft outer glow (core colour → transparent).
      const glow = octx.createRadialGradient(cx, cy, 0, cx, cy, SPRITE_GLOW_R);
      glow.addColorStop(0, colors.core);
      glow.addColorStop(1, "transparent");
      octx.fillStyle = glow;
      octx.beginPath();
      octx.arc(cx, cy, SPRITE_GLOW_R, 0, Math.PI * 2);
      octx.fill();
      // Crisp gold-deep core (baked brighter so a single drawImage reproduces
      // the old two-pass glow+core look).
      octx.fillStyle = colors.deep;
      octx.beginPath();
      octx.arc(cx, cy, SPRITE_GLOW_R / 3, 0, Math.PI * 2);
      octx.fill();
      return off;
    }

    function makeEmber(seedY?: number): Ember {
      return {
        x: Math.random() * width,
        y: seedY ?? height + Math.random() * height,
        r: 0.6 + Math.random() * 1.8,
        vy: 6 + Math.random() * 16,
        sway: 6 + Math.random() * 18,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.12 + Math.random() * 0.3,
        tw: 0.4 + Math.random() * 1.1,
      };
    }

    function seed() {
      const count = Math.min(
        MAX_PARTICLES,
        Math.max(12, Math.round((width * height) / 26000)),
      );
      embers = Array.from({ length: count }, () =>
        makeEmber(Math.random() * height),
      );
    }

    function resize() {
      const rect = parent.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      const c = canvas as HTMLCanvasElement;
      c.width = Math.round(width * dpr);
      c.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      colors = goldColors();
      seed();
    }

    let raf = 0;
    let last = performance.now();
    let elapsed = 0;

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;
      ctx!.clearRect(0, 0, width, height);

      // Rebuild the sprite lazily after a theme change (never mid-loop).
      if (spriteDirty) {
        sprite = buildSprite();
        spriteDirty = false;
      }

      if (sprite) {
        for (const e of embers) {
          e.y -= e.vy * dt;
          const drawX = e.x + Math.sin(elapsed * 0.6 + e.phase) * e.sway;
          // Recycle motes that rise off the top.
          if (e.y < -8) {
            Object.assign(e, makeEmber(height + 8));
            continue;
          }
          const twinkle = 0.6 + 0.4 * Math.sin(elapsed * e.tw + e.phase);
          ctx!.globalAlpha = e.alpha * twinkle;
          // Scale the sprite so its glow radius spans the mote's `r*3` extent —
          // one cheap drawImage replaces the old per-frame gradient + two arcs.
          const drawn = ((e.r * 3) / SPRITE_GLOW_R) * SPRITE_SIZE;
          ctx!.drawImage(
            sprite,
            drawX - drawn / 2,
            e.y - drawn / 2,
            drawn,
            drawn,
          );
        }
      }
      ctx!.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    }

    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(parent);
    // Re-resolve the gold tokens whenever the theme attribute on <html> flips,
    // so dark-mode embers don't keep painting the light-mode gold. Flag the
    // sprite for a one-off rebuild on the next frame (never mid-loop).
    const themeObserver = new MutationObserver(() => {
      colors = goldColors();
      spriteDirty = true;
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-woa", "class"],
    });
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      themeObserver.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity: 0.9,
      }}
    />
  );
}
