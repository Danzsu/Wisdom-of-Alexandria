import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { hu } from "@/lib/i18n/hu";

export interface ErrorStateProps {
  /** Short human-readable error message shown prominently. */
  message: string;
  /** Optional additional context rendered as muted secondary text. */
  detail?: string;
  /** If provided, a retry button is rendered. */
  onRetry?: () => void;
  className?: string;
}

/**
 * Compact inline error panel with `role="alert"` so assistive tech announces
 * it immediately. Danger icon (decorative), message, optional muted detail,
 * optional retry button.
 *
 * Visual treatment: full border (no side-stripe), `rounded-lg`.
 * No hardcoded strings — retry label comes from `hu.common.retry`.
 */
export function ErrorState({
  message,
  detail,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-2.5 rounded-lg border border-danger bg-surface px-5 py-4",
        className,
      )}
    >
      <span className="flex items-center gap-2">
        <AlertTriangle
          aria-hidden="true"
          size={16}
          className="flex-none text-danger-text"
        />
        <p className="m-0 text-field font-semibold text-text">{message}</p>
      </span>
      {detail ? (
        <p className="m-0 text-body text-text-muted">{detail}</p>
      ) : null}
      {onRetry ? (
        <Button variant="secondary" size={32} onClick={onRetry}>
          {hu.common.retry}
        </Button>
      ) : null}
    </div>
  );
}
