/**
 * Plotline status → calm StatusPill variant (Plotline-b).
 *
 * The four backend statuses map to four distinct, low-saturation badge tones so
 * status is conveyed by a paired colour + label (never colour alone):
 *   planning  → neutral  (quiet, not yet underway)
 *   active    → accent   (the live thread)
 *   resolved  → success  (closed out)
 *   abandoned → warning  (dropped, but not an error)
 * Anything unexpected degrades to neutral rather than throwing.
 */
export type PlotlineStatusVariant =
  | "neutral"
  | "accent"
  | "success"
  | "warning";

const STATUS_VARIANT: Record<string, PlotlineStatusVariant> = {
  planning: "neutral",
  active: "accent",
  resolved: "success",
  abandoned: "warning",
};

/** Resolve a plotline status string to its calm pill variant. */
export function plotlineStatusVariant(status: string): PlotlineStatusVariant {
  return STATUS_VARIANT[status] ?? "neutral";
}
