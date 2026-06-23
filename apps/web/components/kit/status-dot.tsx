import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusDotVariants = cva("inline-block flex-none rounded-full", {
  variants: {
    variant: {
      success: "bg-success",
      danger: "bg-danger",
      neutral: "bg-text-faint",
      accent: "bg-accent",
      warning: "bg-warning",
      ai: "bg-ai",
    },
    size: {
      6: "h-1.5 w-1.5",
      7: "h-[7px] w-[7px]",
      8: "h-2 w-2",
      16: "h-4 w-4",
    },
  },
  defaultVariants: {
    variant: "neutral",
    size: 8,
  },
});

type StatusDotVariantProp = NonNullable<
  VariantProps<typeof statusDotVariants>["variant"]
>;
export type StatusDotVariant = StatusDotVariantProp;

export interface StatusDotProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof statusDotVariants> {
  /**
   * Special-cased dot treatments from the prototype:
   * - `timeline` → 16px filled accent + 3px bg ring + 1px border outline.
   * - `planned`  → 16px surface + 2px dashed border-strong (planned node).
   * - `presence` → 9px coloured dot + 1.5px surface border (overlay badge).
   */
  treatment?: "timeline" | "planned" | "presence";
}

/**
 * Small round status indicator. Plain dots use `variant` + `size`. The
 * `treatment` prop produces the three composite dots used by the timeline and
 * presence affordances. Decorative by default; pass `aria-label` to expose it.
 */
export const StatusDot = forwardRef<HTMLSpanElement, StatusDotProps>(
  function StatusDot(
    { className, variant, size, treatment, "aria-label": ariaLabel, ...props },
    ref,
  ) {
    // When a label is provided the span must have role="img" so the aria-label
    // is valid (aria-label on a role-less span is a prohibited attribute).
    // When no label is given the dot is purely decorative and is hidden from AT.
    const a11y = ariaLabel
      ? ({ role: "img" as const, "aria-label": ariaLabel })
      : ({ "aria-hidden": true });

    if (treatment === "timeline") {
      return (
        <span
          ref={ref}
          {...a11y}
          className={cn(
            "inline-block h-4 w-4 flex-none rounded-full border-[3px] border-bg bg-accent shadow-[0_0_0_1px_var(--border)]",
            className,
          )}
          {...props}
        />
      );
    }
    if (treatment === "planned") {
      return (
        <span
          ref={ref}
          {...a11y}
          className={cn(
            "inline-block h-4 w-4 flex-none rounded-full border-2 border-dashed border-border-strong bg-surface",
            className,
          )}
          {...props}
        />
      );
    }
    if (treatment === "presence") {
      return (
        <span
          ref={ref}
          {...a11y}
          className={cn(
            statusDotVariants({ variant }),
            "h-[9px] w-[9px] border-[1.5px] border-surface",
            className,
          )}
          {...props}
        />
      );
    }
    return (
      <span
        ref={ref}
        {...a11y}
        className={cn(statusDotVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
