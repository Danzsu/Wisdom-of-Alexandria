"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { hu } from "@/lib/i18n/hu";

/**
 * Route-segment error boundary for the in-app `(app)` routes. A synchronous
 * render-time throw inside the shell's main area (editor, data views, AI panel)
 * is caught here and rendered as a recoverable panel INSIDE the shell — the
 * TopBar / sidebars / StatusBar stay mounted, so the workspace is never lost.
 *
 * App Router supplies the exact `{ error, reset }` signature; `reset` re-renders
 * the segment. We never white-screen and never swallow: the error is logged for
 * dev visibility while a visible, recoverable fallback takes over.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface for dev/observability — the fallback below still renders.
    console.error("App route error boundary caught:", error);
  }, [error]);

  return (
    <div
      role="alert"
      aria-label={hu.errors.regionAria}
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-muted text-danger-text">
        <Icon icon={AlertTriangle} size={22} />
      </span>
      <p className="m-0 text-[15px] font-semibold text-text">
        {hu.errors.routeTitle}
      </p>
      <p className="m-0 max-w-[380px] text-[13px] leading-[1.5] text-text-muted">
        {hu.errors.routeHint}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-1 flex h-9 items-center gap-1.5 rounded-lg bg-accent-strong px-3.5 text-[13px] font-semibold text-accent-fg hover:bg-accent-hover"
      >
        <Icon icon={RotateCcw} size={14} />
        {hu.errors.routeRetry}
      </button>
    </div>
  );
}
