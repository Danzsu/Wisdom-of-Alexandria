/**
 * Scene status → timeline marker-state mapping (UX-3b) + the human status label.
 *
 * Scene `status` is a free-form string server-side (the schema types it as
 * `z.string()`), but in practice it is one of: "draft", "in_progress",
 * "complete", "archived". The timeline marker has three visual states
 * (`completed` / `current` / `planned`), so we collapse the four statuses:
 *
 *   complete    → "completed"  (a finished scene — the filled accent marker)
 *   in_progress → "current"    (actively being written — the ring marker)
 *   draft       → "planned"    (not started — the dashed marker)
 *   archived    → "planned"    (set aside — also dashed; archived scenes are
 *                               normally excluded from lists, but a stray one
 *                               degrades gracefully to "planned")
 *   (anything else / unknown)  → "planned"  (safe default — never throws)
 *
 * Kept in its own module so the mapping is unit-testable in isolation and the
 * screen stays a thin renderer.
 */
import type { TimelineMarkerState } from "@/components/kit/timeline";
import { hu } from "@/lib/i18n/hu";

/** Map a scene status string to a timeline marker state (see module doc). */
export function statusToMarkerState(status: string): TimelineMarkerState {
  switch (status) {
    case "complete":
      return "completed";
    case "in_progress":
      return "current";
    case "draft":
    case "archived":
    default:
      return "planned";
  }
}

/** Human (Hungarian) label for a scene status; falls back to the raw value. */
export function sceneStatusLabel(status: string): string {
  switch (status) {
    case "complete":
      return hu.timeline.statusComplete;
    case "in_progress":
      return hu.timeline.statusInProgress;
    case "draft":
      return hu.timeline.statusDraft;
    case "archived":
      return hu.timeline.statusArchived;
    default:
      // Unknown status — show the raw value rather than hiding it.
      return status;
  }
}
