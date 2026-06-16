"use client";

import { AlertTriangle } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { useNavTo } from "@/lib/use-nav-to";
import { useActiveJobCount, useFailedJobCount } from "@/lib/api/ai-hooks";
import { routes } from "@/lib/routes";
import { hu } from "@/lib/i18n/hu";

export interface AiJobIndicatorProps {
  /** Active book id; the indicator is scoped to this book's jobs. */
  bookId: string | null;
}

/**
 * Persistent, calm AI-job indicator for the TopBar (B1 hooks). Honest by design:
 *
 * - running/pending jobs → a subtle "AI dolgozik" pill with a gentle pulsing dot
 *   (opacity-only breathing; no flashy spin/bounce, reduced-motion-aware via the
 *   global reduced-motion block which neutralizes the animation).
 * - failed jobs (and nothing running) → an attention pill with the failed count,
 *   linking to the feladatok (AI jobs) screen.
 * - idle → renders NOTHING (no permanent badge, no fabricated state).
 *
 * Running takes precedence over failed so the user sees current activity first;
 * the failed count remains reachable on the feladatok screen.
 */
export function AiJobIndicator({ bookId }: Readonly<AiJobIndicatorProps>) {
  const navTo = useNavTo();
  const activeCount = useActiveJobCount(bookId || undefined);
  const failedCount = useFailedJobCount(bookId || undefined);

  // Idle (and no book) → show nothing.
  if (!bookId) return null;

  if (activeCount > 0) {
    return (
      <span
        role="status"
        aria-live="polite"
        aria-label={hu.statusbar.aiWorkingAria(activeCount)}
        className="flex h-[22px] items-center gap-1.5 rounded-full bg-ai-muted px-2.5 text-[11px] font-semibold text-ai-text"
      >
        <span
          aria-hidden="true"
          className="h-[7px] w-[7px] flex-none rounded-full bg-ai [animation:woaPulse_1.8s_ease-in-out_infinite]"
        />
        {hu.statusbar.aiWorking}
      </span>
    );
  }

  if (failedCount > 0) {
    return (
      <button
        type="button"
        aria-label={hu.statusbar.aiFailedAria(failedCount)}
        onClick={() => navTo(routes.book(bookId, "feladatok"))}
        className="flex h-[22px] items-center gap-1.5 rounded-full bg-danger-muted px-2.5 text-[11px] font-semibold text-danger-text transition-colors hover:bg-danger-muted/80"
      >
        <Icon icon={AlertTriangle} size={11} />
        {hu.statusbar.aiFailed(failedCount)}
      </button>
    );
  }

  // Honest idle state: nothing in flight, nothing failed → no indicator.
  return null;
}
