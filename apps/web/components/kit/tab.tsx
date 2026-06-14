import { forwardRef, useRef } from "react";
import type {
  ButtonHTMLAttributes,
  KeyboardEvent,
  ReactNode,
} from "react";
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
  { className, orientation, active, icon, type, tabIndex, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      role="tab"
      aria-selected={active ?? false}
      // Roving tabindex (WAI-ARIA tabs): only the selected tab is in the tab
      // order; the rest are reached with the arrow keys (see TabBar). A caller
      // may still override `tabIndex` explicitly.
      tabIndex={tabIndex ?? (active ? 0 : -1)}
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
 *
 * Implements the WAI-ARIA tabs keyboard pattern with automatic activation:
 * ArrowLeft/ArrowRight move between tabs (wrapping) and Home/End jump to the
 * ends. Activation rides on each Tab's own click handler — we focus the target
 * tab and dispatch a click so the consumer's `onClick` selects it — keeping the
 * Tab/TabBar API unchanged. A standalone `Tab` (no TabBar) degrades to a plain
 * button with roving tabindex (`active` → tabbable) but no arrow nav.
 */
export function TabBar({
  children,
  scrollable,
  className,
  "aria-label": ariaLabel,
}: TabBarProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (
      e.key !== "ArrowRight" &&
      e.key !== "ArrowLeft" &&
      e.key !== "Home" &&
      e.key !== "End"
    ) {
      return;
    }
    const root = ref.current;
    if (!root) return;
    // Only enabled tabs participate in roving.
    const tabs = Array.from(
      root.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])'),
    );
    if (tabs.length === 0) return;
    const current = tabs.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const from = current === -1 ? 0 : current;
    let next: number;
    if (e.key === "ArrowRight") {
      next = (from + 1) % tabs.length;
    } else if (e.key === "ArrowLeft") {
      next = (from - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      next = 0;
    } else {
      next = tabs.length - 1;
    }
    e.preventDefault();
    const target = tabs[next];
    target.focus();
    // Automatic activation: drive the consumer's onClick selection.
    target.click();
  }

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
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
