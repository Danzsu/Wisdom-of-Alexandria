import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

const buttonVariants = cva(
  // Shared: flex row, centred content, inherited font, depress on press.
  "inline-flex items-center justify-center gap-1.5 font-sans text-body font-medium leading-none cursor-pointer transition-colors active:translate-y-px active:scale-[.985] disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        cta: "border-none bg-accent-strong text-accent-fg font-semibold hover:bg-accent-hover",
        secondary:
          "border border-border bg-transparent text-text-soft hover:bg-surface-muted",
        ghost:
          "border-none bg-transparent text-text-soft hover:bg-surface-muted",
        success:
          "border-none bg-success text-success-fg font-semibold hover:brightness-95",
        destructive:
          "border-none bg-danger-solid text-danger-solid-fg font-semibold hover:brightness-95",
        "accent-outline":
          "border border-accent bg-accent-muted text-accent-text font-semibold hover:bg-accent-strong hover:text-accent-fg",
        dashed:
          "border border-dashed border-border-strong bg-transparent text-text-muted hover:border-accent hover:bg-accent-muted hover:text-accent-text",
      },
      shape: {
        pill: "rounded-full",
        block: "rounded-lg", // 8px; matches the prototype block buttons
      },
      size: {
        28: "h-7 px-[11px] text-xs",
        30: "h-[30px] px-[14px]",
        32: "h-8 px-[13px]",
        34: "h-[34px] px-[14px]",
        40: "h-10 px-4 text-sm",
      },
    },
    defaultVariants: {
      variant: "secondary",
      shape: "block",
      size: 32,
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Element rendered before the label (e.g. an `<Icon />`). */
  leadingIcon?: ReactNode;
  /** Element rendered after the label. */
  trailingIcon?: ReactNode;
  /**
   * Adds the gold-sweep `.woa-cta` shimmer on hover. Intended for the primary
   * `cta` action; the class lives in globals.css.
   */
  sweep?: boolean;
  /**
   * Shows a `Spinner` in the leading-icon slot, forces `disabled`, and sets
   * `aria-busy`. The label stays visible so the button width is stable.
   */
  loading?: boolean;
  children?: ReactNode;
}

/**
 * Primary action button. `variant` selects the visual treatment (cta /
 * secondary / ghost / success / destructive / accent-outline / dashed),
 * `shape` toggles pill vs. block radius, `size` sets the height. Optional
 * leading/trailing icon slots and a `sweep` flag for the CTA gold shimmer.
 */
/** Map button size to spinner diameter (px). */
const SPINNER_SIZE: Record<NonNullable<ButtonProps["size"]>, number> = {
  28: 12,
  30: 13,
  32: 13,
  34: 14,
  40: 15,
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant,
      shape,
      size,
      leadingIcon,
      trailingIcon,
      sweep,
      loading,
      disabled,
      type,
      children,
      ...props
    },
    ref,
  ) {
    const isDisabled = disabled || loading;
    const resolvedSize = size ?? 32;
    const resolvedLeadingIcon = loading ? (
      <Spinner size={SPINNER_SIZE[resolvedSize]} variant="accent" label="Betöltés" />
    ) : leadingIcon;

    return (
      <button
        ref={ref}
        type={type ?? "button"}
        data-press=""
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={cn(
          buttonVariants({ variant, shape, size }),
          sweep && "woa-cta",
          className,
        )}
        {...props}
      >
        {resolvedLeadingIcon}
        {children}
        {trailingIcon}
      </button>
    );
  },
);

export { buttonVariants };
