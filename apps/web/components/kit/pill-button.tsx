import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { StatusDot, type StatusDotVariant } from "./status-dot";

const pillButtonVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border font-sans text-[13px] cursor-pointer transition-colors active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      active: {
        true: "border-accent bg-accent-muted text-accent-text",
        false:
          "border-border bg-transparent text-text-soft hover:border-accent hover:bg-accent-muted hover:text-accent-text",
      },
      size: {
        30: "h-[30px] px-3",
        32: "h-8 px-[14px]",
      },
    },
    defaultVariants: {
      active: false,
      size: 32,
    },
  },
);

export interface PillButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color">,
    VariantProps<typeof pillButtonVariants> {
  /** Optional leading glyph (e.g. an `<Icon />`). Mutually used with the label. */
  leadingIcon?: ReactNode;
  /** Show a trailing chevron (dropdown affordance). */
  chevron?: boolean;
  /** Leading severity dot colour; renders a `StatusDot` before the label. */
  dot?: StatusDotVariant;
  /** Trailing tabular count with reduced opacity. */
  count?: number;
  children?: ReactNode;
}

/**
 * Rounded filter chip / pill button. Use `leadingIcon` + `chevron` for a
 * dropdown-style chip, or `dot` + `count` for a faceted-filter chip. The
 * `active` prop applies the accent-tinted selected state.
 */
export const PillButton = forwardRef<HTMLButtonElement, PillButtonProps>(
  function PillButton(
    {
      className,
      active,
      size,
      leadingIcon,
      chevron,
      dot,
      count,
      type,
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        aria-pressed={active ?? undefined}
        className={cn(pillButtonVariants({ active, size }), className)}
        {...props}
      >
        {dot ? <StatusDot variant={dot} size={7} /> : null}
        {leadingIcon}
        <span>{children}</span>
        {typeof count === "number" ? (
          <span className="tabular-nums opacity-70">{count}</span>
        ) : null}
        {chevron ? <Icon icon={ChevronDown} size={14} /> : null}
      </button>
    );
  },
);

/** Alias: a FilterChip is a PillButton — same primitive, intent-named. */
export const FilterChip = PillButton;
