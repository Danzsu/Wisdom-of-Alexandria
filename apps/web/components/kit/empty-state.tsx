import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { CelestialBackdrop } from "./celestial-backdrop";

export interface EmptyStateActionObject {
  label: string;
  onClick: () => void;
}

export interface EmptyStateProps {
  /** Optional decorative icon rendered in a soft rounded badge. */
  icon?: ReactNode;
  /** Main heading (rendered as h2). */
  title: string;
  /** Optional muted description paragraph. */
  description?: string;
  /**
   * Optional CTA: either a `{ label, onClick }` shorthand (renders an
   * accent-outline Button) or a custom ReactNode for full control.
   */
  action?: EmptyStateActionObject | ReactNode;
  className?: string;
}

/**
 * Centered column empty-state pattern. Icon in a soft accent badge, serif
 * title, muted description, optional CTA button.
 *
 * No hardcoded strings — all copy comes from the caller.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  const actionNode =
    action && isActionObject(action) ? (
      <Button variant="accent-outline" size={34} onClick={action.onClick}>
        {action.label}
      </Button>
    ) : (
      action
    );

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-3 overflow-hidden rounded-lg px-6 py-14 text-center",
        className,
      )}
    >
      {/* Decorative "starlit" backdrop — faint, behind the content. */}
      <CelestialBackdrop density={14} opacity={0.5} />

      {icon ? (
        <span
          aria-hidden="true"
          className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-muted text-accent-text [animation:woaGlow_5.5s_ease-in-out_infinite]"
        >
          {icon}
        </span>
      ) : null}
      <h2 className="relative z-10 m-0 font-serif text-title font-semibold text-text">
        {title}
      </h2>
      {description ? (
        <p className="relative z-10 m-0 max-w-prose text-body text-text-muted">
          {description}
        </p>
      ) : null}
      {actionNode ? (
        <div className="relative z-10 mt-1">{actionNode}</div>
      ) : null}
    </div>
  );
}

function isActionObject(
  action: EmptyStateActionObject | ReactNode,
): action is EmptyStateActionObject {
  return (
    typeof action === "object" &&
    action !== null &&
    !Array.isArray(action) &&
    "label" in (action as object) &&
    "onClick" in (action as object)
  );
}
