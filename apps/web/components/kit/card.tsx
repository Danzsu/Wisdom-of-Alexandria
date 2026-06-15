import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { COVER_GRADIENT } from "@/lib/gradients";

/** Coloured left edge (3px) for status emphasis. */
export type CardAccentEdge =
  | "success"
  | "danger"
  | "warning"
  | "ai"
  | "accent";

const EDGE_CLASS: Record<CardAccentEdge, string> = {
  success: "border-l-[3px] border-l-success",
  danger: "border-l-[3px] border-l-danger",
  warning: "border-l-[3px] border-l-warning",
  ai: "border-l-[3px] border-l-ai",
  accent: "border-l-[3px] border-l-accent",
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Hover-lift affordance: translate up + panel shadow + stronger border. */
  interactive?: boolean;
  /** Selected state: accent ring + accent-muted background. */
  selected?: boolean;
  /** Coloured 3px left edge for status. */
  accentEdge?: CardAccentEdge;
  /**
   * Render an 88px gradient cover header at the top. Provide the cover content
   * (icon, etc.); the card body still renders `children` below it.
   */
  coverTop?: ReactNode;
  /** `gold` (default) or `blueGrey` gradient for `coverTop`. */
  coverVariant?: "gold" | "blueGrey";
  children?: ReactNode;
}

/**
 * Surface card. Default: surface bg, border, 12px radius, card shadow, 16px
 * padding. Modifiers: `interactive` (hover lift), `selected` (accent ring),
 * `accentEdge` (coloured left edge), `coverTop` (gradient header slot).
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    className,
    interactive,
    selected,
    accentEdge,
    coverTop,
    coverVariant = "gold",
    children,
    ...props
  },
  ref,
) {
  // With a cover header we must clip the gradient to the rounded corners, so
  // padding moves onto an inner body wrapper instead of the outer shell.
  const hasCover = Boolean(coverTop);
  return (
    <div
      ref={ref}
      className={cn(
        "rounded-xl border border-border bg-surface shadow-card",
        !hasCover && "p-4",
        hasCover && "overflow-hidden",
        accentEdge && EDGE_CLASS[accentEdge],
        interactive &&
          "transition-[transform,box-shadow,border-color] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-panel",
        selected && "border-accent ring-2 ring-accent bg-accent-muted",
        className,
      )}
      {...props}
    >
      {hasCover ? (
        <>
          <div
            className="flex h-[88px] items-end justify-center border-b border-border pb-3 text-accent-fg"
            style={{ background: COVER_GRADIENT[coverVariant] }}
          >
            {coverTop}
          </div>
          <div className="p-4">{children}</div>
        </>
      ) : (
        children
      )}
    </div>
  );
});
