/**
 * Map a 1-based POV slot (pov1..pov6) to its Tailwind badge colour token classes
 * (background + text). Mirrors the slot→token mapping used by the Avatar / Badge
 * kit and the editor's codex-mention view, so the same character is always the
 * same colour across the app. Unknown slots fall back to pov3 (the neutral
 * green) rather than blanking the badge.
 */
const POV_SLOT_CLASS: Record<number, string> = {
  1: "bg-pov1-bg text-pov1-tx",
  2: "bg-pov2-bg text-pov2-tx",
  3: "bg-pov3-bg text-pov3-tx",
  4: "bg-pov4-bg text-pov4-tx",
  5: "bg-pov5-bg text-pov5-tx",
  6: "bg-pov6-bg text-pov6-tx",
};

/** Tailwind bg+text classes for a POV slot (defaults to pov3). */
export function povBadgeClass(slot: number): string {
  return POV_SLOT_CLASS[slot] ?? POV_SLOT_CLASS[3];
}
