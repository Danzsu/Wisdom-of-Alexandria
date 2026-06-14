import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const sectionEyebrowVariants = cva(
  "text-[11px] font-semibold uppercase tracking-[0.08em]",
  {
    variants: {
      tone: {
        muted: "text-text-muted",
        faint: "text-text-faint",
        accent: "text-accent-text",
      },
    },
    defaultVariants: {
      tone: "muted",
    },
  },
);

export interface SectionEyebrowProps
  extends HTMLAttributes<HTMLElement>,
    VariantProps<typeof sectionEyebrowVariants> {
  /** Render as a block element (`<h3>`) vs. an inline `<span>`. */
  as?: "span" | "h3";
}

/**
 * Small uppercase section label (the "eyebrow" above panels/popovers). Default
 * tone is muted; `faint` for popover headers, `accent` for highlighted groups.
 */
export const SectionEyebrow = forwardRef<HTMLElement, SectionEyebrowProps>(
  function SectionEyebrow({ className, tone, as = "span", ...props }, ref) {
    const classes = cn(sectionEyebrowVariants({ tone }), className);
    if (as === "h3") {
      return (
        <h3
          ref={ref as React.Ref<HTMLHeadingElement>}
          className={classes}
          {...props}
        />
      );
    }
    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        className={classes}
        {...props}
      />
    );
  },
);
