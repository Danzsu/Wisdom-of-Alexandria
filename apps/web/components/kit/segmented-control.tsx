"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
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
  // Refs to each radio button so arrow-key roving can move focus to the
  // newly-selected segment (WAI-ARIA radio group pattern).
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = options.findIndex((o) => o.value === value);

  /** Move + select with the arrow keys (wrapping); Home/End jump to the ends. */
  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const count = options.length;
    if (count === 0) return;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (index + 1) % count;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (index - 1 + count) % count;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = count - 1;
    }
    if (next === null) return;
    e.preventDefault();
    onValueChange(options[next].value);
    buttonsRef.current[next]?.focus();
  }

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
        // Roving tabindex: only the selected segment is tabbable; if nothing is
        // selected yet the first segment takes the tab stop.
        const tabbable =
          selectedIndex === -1 ? index === 0 : index === selectedIndex;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonsRef.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={variant === "icon" ? option.label : undefined}
            tabIndex={tabbable ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
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
