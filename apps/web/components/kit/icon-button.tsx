import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const iconButtonVariants = cva(
  // Square, centred, transparent, depress on press via the data-press hook.
  "inline-flex flex-none items-center justify-center bg-transparent text-text-muted cursor-pointer transition-colors active:translate-y-px active:scale-[.985] disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "hover:bg-surface-muted hover:text-text",
        ai: "hover:bg-surface-muted hover:text-accent-text",
        danger: "hover:bg-danger-muted hover:text-danger-text",
      },
      size: {
        24: "h-6 w-6 rounded-md", // 6px radius
        26: "h-[26px] w-[26px] rounded-md",
        28: "h-7 w-7 rounded-lg", // 8px radius
        30: "h-[30px] w-[30px] rounded-lg",
        32: "h-8 w-8 rounded-lg",
        38: "h-[38px] w-[38px] rounded-[10px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: 28,
    },
  },
);

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof iconButtonVariants> {
  /** Required: icon-only buttons must name their action for assistive tech. */
  "aria-label": string;
}

/**
 * Square, transparent icon-only button. Hover tints the surface; `ai` and
 * `danger` variants shift the hover colour. An `aria-label` is mandatory.
 * Press state is exposed via `data-press` plus an active depress transform.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ className, variant, size, type, ...props }, ref) {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        data-press=""
        className={cn(iconButtonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
