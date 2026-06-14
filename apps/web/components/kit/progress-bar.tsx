import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface ProgressBarBaseProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Wrapper class for the outer flex row (label alignment etc.). */
  wrapperClassName?: string;
}

interface DeterminateProps extends ProgressBarBaseProps {
  indeterminate?: false;
  /** Fill percentage 0–100. */
  value: number;
  /** Render a trailing tabular % label. */
  showLabel?: boolean;
}

interface IndeterminateProps extends ProgressBarBaseProps {
  indeterminate: true;
  value?: never;
  showLabel?: never;
}

export type ProgressBarProps = DeterminateProps | IndeterminateProps;

/** Clamp a percentage into the 0–100 range. */
function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Track-and-fill progress bar. `determinate` (default) renders a fill at
 * `value`%. `indeterminate` renders a 33%-wide bar that slides via the
 * `woaProgress` keyframe — animation only, never a width transition.
 */
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  function ProgressBar(
    {
      className,
      wrapperClassName,
      indeterminate = false,
      value = 0,
      showLabel = false,
      ...domProps
    },
    ref,
  ) {
    const pct = clampPct(value);
    return (
      <div className={cn("flex items-center gap-2", wrapperClassName)}>
        <div
          ref={ref}
          role="progressbar"
          aria-valuemin={indeterminate ? undefined : 0}
          aria-valuemax={indeterminate ? undefined : 100}
          aria-valuenow={indeterminate ? undefined : Math.round(pct)}
          className={cn(
            "h-[5px] flex-1 overflow-hidden rounded-full bg-accent-muted",
            className,
          )}
          {...domProps}
        >
          {indeterminate ? (
            <div className="h-full w-1/3 rounded-full bg-accent [animation:woaProgress_1.1s_ease-in-out_infinite]" />
          ) : (
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
        {!indeterminate && showLabel ? (
          <span className="tabular-nums text-xs text-text-muted">
            {Math.round(pct)}%
          </span>
        ) : null}
      </div>
    );
  },
);
