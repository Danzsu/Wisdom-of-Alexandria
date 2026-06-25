"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

export interface CelestialBackdropProps {
  /**
   * Number of stars to render. Kept small and capped (≤ 24) so the layer stays
   * cheap. Default 18.
   */
  density?: number;
  /**
   * Opacity multiplier applied to every star (0–1). Per-star opacities are
   * already low (~0.15–0.45); this scales the whole field. Default 1.
   */
  opacity?: number;
  className?: string;
}

/** Hard cap so callers can never make this expensive. */
const MAX_STARS = 24;

/** Tint tokens cycled across the field — gold, accent and faint text only. */
const TINTS = ["var(--gold)", "var(--accent)", "var(--text-faint)"] as const;

interface Star {
  /** left %, top % */
  left: number;
  top: number;
  /** 1–3 px */
  size: number;
  /** base opacity 0.15–0.45 */
  baseOpacity: number;
  tint: string;
  /** twinkle duration (s) */
  twinkle: number;
  /** drift duration (s) */
  drift: number;
  /** negative animation-delay (s) so the field is desynchronised */
  delay: number;
}

/**
 * Deterministic pseudo-random star field. Seeded so the same `density` always
 * produces the same layout — stable across SSR/CSR (no hydration mismatch) and
 * across re-renders. A tiny LCG keeps it dependency-free.
 */
function buildStars(count: number): Star[] {
  let seed = 0x5eed + count * 977;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const stars: Star[] = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      left: Math.round(rand() * 1000) / 10,
      top: Math.round(rand() * 1000) / 10,
      size: 1 + Math.round(rand() * 2), // 1–3px
      baseOpacity: 0.15 + Math.round(rand() * 30) / 100, // 0.15–0.45
      tint: TINTS[i % TINTS.length],
      twinkle: 4 + Math.round(rand() * 40) / 10, // 4–8s
      drift: 14 + Math.round(rand() * 80) / 10, // 14–22s
      delay: -Math.round(rand() * 100) / 10, // -0..-10s
    });
  }
  return stars;
}

/**
 * Ambient "celestial calm" backdrop — a very subtle, decorative field of tiny
 * twinkling/drifting stars tinted with the brand gold / accent / faint-text
 * tokens. Purely ornamental: the wrapper is `aria-hidden`, `pointer-events:none`
 * and sits behind content.
 *
 * Motion (twinkle + slow drift) reuses the global `woaTwinkle` / `woaFloatSlow`
 * keyframes; the global `prefers-reduced-motion` block neutralises both to a
 * static field. No `<canvas>` — pure absolutely-positioned spans.
 */
export function CelestialBackdrop({
  density = 18,
  opacity = 1,
  className,
}: CelestialBackdropProps) {
  const count = Math.max(0, Math.min(MAX_STARS, Math.round(density)));
  const stars = useMemo(() => buildStars(count), [count]);

  return (
    <div
      aria-hidden="true"
      data-celestial-backdrop=""
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      style={{ opacity }}
    >
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            backgroundColor: s.tint,
            opacity: s.baseOpacity,
            // Twinkle (opacity) + slow drift (transform). Both are global
            // keyframes; reduced-motion collapses their duration to ~0 so the
            // field renders static. `both` keeps the resting opacity applied.
            animation: `woaTwinkle ${s.twinkle}s ease-in-out ${s.delay}s infinite, woaFloatSlow ${s.drift}s ease-in-out ${s.delay}s infinite`,
            willChange: "opacity, transform",
          }}
        />
      ))}
    </div>
  );
}
