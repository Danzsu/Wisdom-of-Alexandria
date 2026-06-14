"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  /** Stable value emitted on selection. */
  value: T;
  /** Visible text label (omit for an icon-only segment). */
  label?: string;
  /** Optional leading/standalone icon node. */
  icon?: ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  /** The options, rendered left-to-right. */
  options: SegmentedOption<T>[];
  /** Currently selected value (controlled). */
  value: T;
  /** Fired with the newly-selected value. */
  onValueChange: (value: T) => void;
  /** `text` (default) → label segments; `icon` → 30px square icon segments. */
  variant?: "text" | "icon";
  /** Accessible group label. */
  "aria-label"?: string;
  className?: string;
}

/**
 * A bordered, single-select segmented control. The active segment shows the
 * solid accent fill; non-first segments carry a left divider. Controlled via
 * `value` / `onValueChange`.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  variant = "text",
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex overflow-hidden rounded-lg border border-border",
        className,
      )}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={variant === "icon" ? option.label : undefined}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 font-sans text-xs transition-colors cursor-pointer",
              variant === "icon" ? "h-[30px] w-[30px]" : "h-[26px] px-[11px]",
              index > 0 && "border-l border-border",
              active
                ? "bg-accent-strong font-semibold text-accent-fg"
                : "bg-transparent text-text-muted hover:text-text",
            )}
          >
            {option.icon}
            {variant === "text" && option.label ? (
              <span>{option.label}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
