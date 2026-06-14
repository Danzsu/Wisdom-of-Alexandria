import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const tabVariants = cva(
  "border-none bg-transparent font-sans cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      orientation: {
        // Horizontal underline tab.
        horizontal:
          "flex h-9 items-center whitespace-nowrap border-b-2 border-transparent px-3 text-[13px]",
        // Vertical icon-over-label inspector tab.
        vertical:
          "flex h-12 flex-1 flex-col items-center justify-center gap-[3px] border-b-2 border-transparent text-[10px] font-medium",
      },
      active: {
        true: "",
        false: "text-text-muted hover:text-text",
      },
    },
    compoundVariants: [
      {
        active: true,
        className: "border-b-accent font-semibold text-accent-text",
      },
    ],
    defaultVariants: {
      orientation: "horizontal",
      active: false,
    },
  },
);

export interface TabProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof tabVariants> {
  /** Optional icon (used above the label in the vertical variant). */
  icon?: ReactNode;
  children?: ReactNode;
}

/**
 * A single tab. `horizontal` is the underline tab; `vertical` is the
 * icon-over-label inspector tab. The `active` prop applies the accent
 * underline + accent text.
 */
export const Tab = forwardRef<HTMLButtonElement, TabProps>(function Tab(
  { className, orientation, active, icon, type, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      role="tab"
      aria-selected={active ?? false}
      className={cn(tabVariants({ orientation, active }), className)}
      {...props}
    >
      {icon}
      {children ? <span>{children}</span> : null}
    </button>
  );
});

export interface TabBarProps {
  children: ReactNode;
  /** Allow the tab row to scroll horizontally when it overflows. */
  scrollable?: boolean;
  /** Accessible label for the tablist. */
  "aria-label"?: string;
  className?: string;
}

/**
 * Container for `Tab`s: a flex row with a bottom border. Set `scrollable` to
 * enable horizontal overflow scrolling for crowded tab rows.
 */
export function TabBar({
  children,
  scrollable,
  className,
  "aria-label": ariaLabel,
}: TabBarProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex gap-0.5 border-b border-border",
        scrollable && "overflow-x-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
