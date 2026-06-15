"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { hu } from "@/lib/i18n/hu";

export interface ErrorBoundaryProps {
  /**
   * Replacement UI when a child throws. May be a node, or a render function
   * receiving the caught error + a `reset` callback that re-mounts the subtree.
   * When omitted, a compact token-styled Hungarian fallback is shown.
   */
  fallback?:
    | ReactNode
    | ((error: Error, reset: () => void) => ReactNode);
  /** Called when the fallback's reset button re-mounts the subtree. */
  onReset?: () => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Client-side React error boundary. Catches a synchronous render-time throw in
 * its subtree and renders a recoverable fallback INSTEAD of letting it bubble
 * (which would otherwise white-screen the whole route). The fallback always
 * surfaces a visible error state with a real reset button — it never silently
 * swallows: `componentDidCatch` logs to the console for dev visibility while the
 * fallback UI takes over.
 *
 * Used to wrap high-risk panes (manuscript editor, AI inspector, plan board) so
 * one pane failing degrades locally rather than taking down the route boundary.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the failure for dev/observability — the fallback UI still renders
    // (this is NOT a swallow; the error is visible both here and on screen).
    console.error("ErrorBoundary caught a render error:", error, info);
  }

  reset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (error !== null) {
      const { fallback } = this.props;
      if (typeof fallback === "function") {
        return fallback(error, this.reset);
      }
      if (fallback !== undefined) {
        return fallback;
      }
      return <DefaultPaneFallback onReset={this.reset} />;
    }
    return this.props.children;
  }
}

/**
 * The compact in-pane default fallback: a small "this panel hit an error —
 * reload" card with an AlertTriangle and a real reset button. Token-styled,
 * `role="alert"` so assistive tech announces the recoverable error region.
 */
function DefaultPaneFallback({ onReset }: Readonly<{ onReset: () => void }>) {
  return (
    <div
      role="alert"
      aria-label={hu.errors.regionAria}
      className="m-3 flex flex-col items-center gap-2.5 rounded-xl border border-danger border-l-[3px] border-l-danger bg-surface px-4 py-5 text-center"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger-muted text-danger-text">
        <Icon icon={AlertTriangle} size={16} />
      </span>
      <p className="m-0 text-[13px] font-semibold text-danger-text">
        {hu.errors.paneTitle}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-[12px] font-medium text-text-soft hover:bg-surface-muted"
      >
        <Icon icon={RotateCcw} size={12} />
        {hu.errors.paneRetry}
      </button>
    </div>
  );
}
