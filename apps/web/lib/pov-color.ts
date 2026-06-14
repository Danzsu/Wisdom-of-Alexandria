/**
 * Deterministic POV colour assignment.
 *
 * A character name maps to a stable POV index (0..5 → pov1..pov6) so the same
 * person always shows the same accent across avatars, badges and graphs. The
 * hash is a simple, stable FNV-style fold — identical input always yields the
 * identical index, independent of runtime or call order.
 */
export const POV_COUNT = 6;

/** POV slot, 1-based to match the `pov1`..`pov6` design tokens. */
export type PovSlot = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Fold an arbitrary string into a 0..(POV_COUNT-1) bucket. The accumulator is
 * masked to 32 bits on every step so the result is platform-stable.
 */
export function povHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    // FNV prime multiply, kept inside 32 bits via Math.imul.
    hash = Math.imul(hash, 16777619);
  }
  // `>>> 0` coerces to an unsigned 32-bit int before the modulo.
  return (hash >>> 0) % POV_COUNT;
}

/** Map a name to its 1-based POV slot (pov1..pov6). */
export function povSlot(value: string): PovSlot {
  return (povHash(value) + 1) as PovSlot;
}
