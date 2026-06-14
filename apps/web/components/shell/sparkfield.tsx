"use client";

import { useEffect } from "react";
import { useUIStore } from "@/lib/stores/ui-store";

/** Star sizes (px) for the 8 sparkfield motes, taken verbatim from the prototype. */
const STAR_SIZES = [14, 10, 16, 9, 12, 11, 13, 10] as const;

/** Filled-star path used by every sparkfield mote (prototype glyph). */
const SPARK_PATH = "M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6Z";

/**
 * Fixed, full-viewport gold sparkfield shown transiently on navigation.
 *
 * Mirrors the prototype's `woa-sparkfield`: 8 absolutely-positioned star spans
 * animated by the `woaSpark` keyframe (positions + delays defined in
 * globals.css). Rendered only while `sparkActive` is set; the store auto-clears
 * the flag after ~1.1s. `prefers-reduced-motion` hides the field via CSS, and
 * the whole layer is `pointer-events:none` + `aria-hidden`.
 *
 * As a belt-and-braces guard, the field also clears the flag on unmount so a
 * route change mid-animation never leaves the store stuck.
 */
export function Sparkfield() {
  const sparkActive = useUIStore((s) => s.sparkActive);
  const clearSpark = useUIStore((s) => s.clearSpark);

  useEffect(() => {
    return () => clearSpark();
  }, [clearSpark]);

  if (!sparkActive) return null;

  return (
    <div className="woa-sparkfield" aria-hidden="true">
      {STAR_SIZES.map((size, i) => (
        <span key={i}>
          <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
            <path d={SPARK_PATH} />
          </svg>
        </span>
      ))}
    </div>
  );
}
