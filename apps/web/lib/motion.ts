"use client";

/**
 * Shared Framer Motion config — the single source of truth for every animated
 * surface in the app, so motion stays CONSISTENT and CALM (Linear-like, never
 * flashy) and is reduced-motion-safe in one place.
 *
 * Brand constraints baked in here:
 *   - entrances/reveals are ease-out ONLY (expo / quint cubic-beziers) with no
 *     overshoot. One sanctioned exception (2026-07 MOTION pass): a SUBTLE
 *     spring (micro-overshoot) for micro-interactions — hover-lift, toast
 *     enter, key presses — via the `--ease-spring` / `--ease-key` CSS tokens
 *     in app/globals.css (mirrored below as EASE_SPRING / EASE_KEY).
 *   - short durations (120–260ms; the spring micro-interactions run 340ms).
 *   - only `transform` (translate/scale) + `opacity` are ever animated — never
 *     layout props (width/height/top/left/margin), which jank.
 *
 * Reduced motion: `useCalmMotion()` wraps framer-motion's `useReducedMotion()`
 * and, when the user prefers reduced motion, returns NO-OP variants that render
 * the final (visible) state with no transition. FM code must honour this
 * independently of the global CSS rule, since FM drives inline styles directly.
 */
import { useReducedMotion, type Variants, type Transition } from "framer-motion";

/* ----------------------------------------------------------------------------
 * Easing curves — ease-out only. Both end at (…, 1) so the value SETTLES into
 * its target without overshooting past it (no bounce). Exported so any ad-hoc
 * FM usage can reuse the exact same feel.
 * -------------------------------------------------------------------------- */
export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_OUT_QUINT: [number, number, number, number] = [
  0.22, 1, 0.36, 1,
];

/* ----------------------------------------------------------------------------
 * CSS motion-token mirrors (single source: app/globals.css :root).
 *   --ease-soft   === EASE_OUT_QUINT (settles, no overshoot)
 *   --ease-spring / --ease-key carry a SUBTLE overshoot (y1 > 1) — reserved
 *   for micro-interactions only (hover-lift, toast enter, key presses).
 * Use the array forms for Framer Motion `ease`; use EASE_VAR.* wherever a CSS
 * string is needed (inline style / animation shorthand) so the app keeps
 * pointing at the one token definition.
 * -------------------------------------------------------------------------- */
export const EASE_SPRING: [number, number, number, number] = [
  0.34, 1.56, 0.64, 1,
];
export const EASE_KEY: [number, number, number, number] = [0.34, 1.4, 0.64, 1];

/** CSS `var()` references for the globals.css easing tokens. */
export const EASE_VAR = {
  soft: "var(--ease-soft)",
  spring: "var(--ease-spring)",
  key: "var(--ease-key)",
} as const;

/* ----------------------------------------------------------------------------
 * Duration tokens (seconds — FM uses seconds). All inside the calm 120–260ms
 * band the brief mandates.
 * -------------------------------------------------------------------------- */
export const DURATION = {
  /** Quick micro-reveal (e.g. a single diff segment). */
  fast: 0.16,
  /** Standard card / panel reveal. */
  base: 0.22,
  /** Slightly longer for larger surfaces. */
  slow: 0.26,
} as const;

/** Per-child stagger step + how many children animate before the delay caps. */
export const STAGGER_STEP = 0.04;
/** Cap the stagger so a big list never feels slow — items past this appear at once. */
export const STAGGER_MAX_ITEMS = 12;

/* ----------------------------------------------------------------------------
 * Standard variants. `fadeInUp` is the canonical entrance: a small upward
 * translate + fade, settling via ease-out. The stagger container/child pair
 * orchestrates a sequence (lists, the Describe channels, diff segments).
 * -------------------------------------------------------------------------- */
const fadeInUp: Variants = {
  hidden: { opacity: 0, transform: "translateY(8px)" },
  visible: {
    opacity: 1,
    transform: "translateY(0px)",
    transition: { duration: DURATION.base, ease: EASE_OUT_QUINT },
  },
  exit: {
    opacity: 0,
    transform: "translateY(4px)",
    transition: { duration: DURATION.fast, ease: EASE_OUT_QUINT },
  },
};

const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: STAGGER_STEP,
      // Items past the cap collapse onto the same tick so long lists stay snappy.
      staggerDirection: 1,
    },
  },
  exit: {},
};

const staggerChild: Variants = {
  hidden: { opacity: 0, transform: "translateY(8px)" },
  visible: {
    opacity: 1,
    transform: "translateY(0px)",
    transition: { duration: DURATION.base, ease: EASE_OUT_QUINT },
  },
  exit: {
    opacity: 0,
    transition: { duration: DURATION.fast, ease: EASE_OUT_QUINT },
  },
};

/* ----------------------------------------------------------------------------
 * The reduced-motion no-op shapes. Every key maps to the FINAL visible state
 * with NO transition, so a `motion.*` element jumps straight to its end frame.
 * -------------------------------------------------------------------------- */
const noopFade: Variants = {
  hidden: { opacity: 1, transform: "none" },
  visible: { opacity: 1, transform: "none", transition: { duration: 0 } },
  exit: { opacity: 1, transform: "none", transition: { duration: 0 } },
};

const noopContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0 } },
  exit: {},
};

export interface CalmMotion {
  /** True when the user prefers reduced motion (variants are no-ops). */
  reduced: boolean;
  /** Canonical fade-up entrance (also has an `exit`). */
  fadeInUp: Variants;
  /** Container variant that staggers its `motion` children. */
  staggerContainer: Variants;
  /** Child variant paired with `staggerContainer`. */
  staggerChild: Variants;
  /**
   * Per-child enter delay (seconds), capped at {@link STAGGER_MAX_ITEMS}. Use on
   * `motion` items that are NOT inside a `staggerContainer` (e.g. dnd-kit cards,
   * which must drive their own transitions). Returns 0 under reduced motion.
   */
  childDelay: (index: number) => number;
  /** Standard ease-out transition for ad-hoc `animate` props. */
  transition: Transition;
}

/**
 * The calm-motion hook. Returns animated variants normally, or the no-op shape
 * when the user prefers reduced motion — so every FM surface is reduced-motion
 * safe by construction. Read `reduced` to skip wrapping entirely where cheaper.
 */
export function useCalmMotion(): CalmMotion {
  const prefersReduced = useReducedMotion();
  const reduced = prefersReduced === true;

  return {
    reduced,
    fadeInUp: reduced ? noopFade : fadeInUp,
    staggerContainer: reduced ? noopContainer : staggerContainer,
    staggerChild: reduced ? noopFade : staggerChild,
    childDelay: (index: number) =>
      reduced ? 0 : Math.min(index, STAGGER_MAX_ITEMS) * STAGGER_STEP,
    transition: reduced
      ? { duration: 0 }
      : { duration: DURATION.base, ease: EASE_OUT_QUINT },
  };
}
