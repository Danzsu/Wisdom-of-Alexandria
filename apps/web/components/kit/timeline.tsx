import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Vertical 2px spine, absolutely positioned at the left of a timeline column.
 * Place inside a `relative` container that wraps the timeline nodes. Forwards any
 * extra attributes (e.g. `data-*` hooks the timeline screen's GSAP draw targets).
 */
export function TimelineSpine({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute left-[7px] top-1.5 bottom-1.5 w-0.5 bg-border",
        className,
      )}
      {...props}
    />
  );
}

/** Marker state along the spine. */
export type TimelineMarkerState = "completed" | "current" | "planned";

export interface TimelineMarkerProps {
  state: TimelineMarkerState;
  className?: string;
}

/**
 * The 16px node marker on the spine. `completed` → filled accent with bg ring +
 * outline; `current` → accent ring (selected); `planned` → surface with a
 * dashed border. Positioned absolutely to sit on the spine.
 */
export function TimelineMarker({ state, className }: TimelineMarkerProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "absolute -left-[26px] top-1 h-4 w-4 rounded-full",
        state === "completed" &&
          "border-[3px] border-bg bg-accent shadow-[0_0_0_1px_var(--border)]",
        state === "current" &&
          "border-[3px] border-bg bg-accent shadow-[0_0_0_2px_var(--accent)]",
        state === "planned" &&
          "border-2 border-dashed border-border-strong bg-surface",
        className,
      )}
    />
  );
}

export interface TimelineNodeProps extends HTMLAttributes<HTMLDivElement> {
  /** Marker state for this node. */
  state: TimelineMarkerState;
  /** Node body (typically a `Card`). */
  children: ReactNode;
}

/**
 * One timeline entry: a relative wrapper with bottom margin, an absolute marker
 * on the spine, and a body slot. Compose multiple inside a `relative` container
 * holding a `TimelineSpine`.
 */
export const TimelineNode = forwardRef<HTMLDivElement, TimelineNodeProps>(
  function TimelineNode({ className, state, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn("relative mb-[22px] pl-1", className)}
        {...props}
      >
        <TimelineMarker state={state} />
        {children}
      </div>
    );
  },
);
