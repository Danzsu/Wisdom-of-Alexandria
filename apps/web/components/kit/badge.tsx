import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-semibold leading-none",
  {
    variants: {
      variant: {
        neutral: "bg-surface-muted text-text-soft",
        accent: "bg-accent-muted text-accent-text",
        ai: "bg-ai-muted text-ai-text",
        success: "bg-success-muted text-success-text",
        warning: "bg-warning-muted text-warning-text",
        danger: "bg-danger-muted text-danger-text",
        severity: "bg-danger-muted text-danger-text font-bold",
        pov1: "bg-pov1-bg text-pov1-tx",
        pov2: "bg-pov2-bg text-pov2-tx",
        pov3: "bg-pov3-bg text-pov3-tx",
        pov4: "bg-pov4-bg text-pov4-tx",
        pov5: "bg-pov5-bg text-pov5-tx",
        pov6: "bg-pov6-bg text-pov6-tx",
      },
      size: {
        16: "h-4 px-1.5 text-[10px]",
        18: "h-[18px] px-[7px] text-[10px]",
        20: "h-5 px-2 text-[11px]",
        24: "h-6 px-[11px] text-[11px]",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: 18,
    },
  },
);

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

/** Map each variant to the dot colour used when no explicit leading glyph is given. */
const DOT_COLOR: Record<BadgeVariant, string> = {
  neutral: "bg-text-faint",
  accent: "bg-accent",
  ai: "bg-ai",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  severity: "bg-danger",
  pov1: "bg-pov1-tx",
  pov2: "bg-pov2-tx",
  pov3: "bg-pov3-tx",
  pov4: "bg-pov4-tx",
  pov5: "bg-pov5-tx",
  pov6: "bg-pov6-tx",
};

export interface BadgeProps
  extends Omit<HTMLAttributes<HTMLSpanElement>, "color">,
    VariantProps<typeof badgeVariants> {
  /**
   * Leading glyph. When omitted, a coloured dot is rendered automatically so a
   * badge is NEVER colour-only (status must never rely on colour alone). Pass
   * `icon={null}`-equivalent by supplying your own dot/icon node here.
   */
  icon?: ReactNode;
  children?: ReactNode;
}

/**
 * Status pill / badge. Always renders a leading icon OR an automatic coloured
 * dot before the label — enforcing the "status is never colour-only" rule.
 * Tokenised variants cover neutral/accent/ai/success/warning/danger/severity
 * and pov1..pov6.
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, variant, size, icon, children, ...props },
  ref,
) {
  const resolvedVariant: BadgeVariant = variant ?? "neutral";
  return (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    >
      {icon ?? (
        <span
          aria-hidden="true"
          className={cn(
            "inline-block h-1.5 w-1.5 flex-none rounded-full",
            DOT_COLOR[resolvedVariant],
          )}
        />
      )}
      {children}
    </span>
  );
});

/** Alias: a StatusPill is the same primitive as Badge, intent-named. */
export const StatusPill = Badge;
