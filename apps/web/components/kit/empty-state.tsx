import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

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
        "flex flex-col items-center gap-3 rounded-lg px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-muted text-accent-text"
        >
          {icon}
        </span>
      ) : null}
      <h2 className="m-0 font-serif text-title font-semibold text-text">
        {title}
      </h2>
      {description ? (
        <p className="m-0 max-w-prose text-body text-text-muted">{description}</p>
      ) : null}
      {actionNode ? <div className="mt-1">{actionNode}</div> : null}
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
