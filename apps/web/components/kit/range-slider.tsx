"use client";

import { forwardRef, useState } from "react";
import type { ComponentPropsWithoutRef, ComponentRef } from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

type SliderRootProps = ComponentPropsWithoutRef<typeof SliderPrimitive.Root>;

export interface RangeSliderProps
  extends Omit<SliderRootProps, "value" | "defaultValue" | "onValueChange"> {
  /** Controlled value. */
  value?: number;
  /** Uncontrolled initial value. */
  defaultValue?: number;
  /** Fired with the single thumb value. */
  onValueChange?: (value: number) => void;
  /** Show a trailing tabular value label (e.g. temperature). */
  showValue?: boolean;
  /** Format the value label (default: the raw number). */
  formatValue?: (value: number) => string;
  /** Wrapper class for the slider + label row. */
  wrapperClassName?: string;
  /** Width (px / class) of the value label column. */
  valueLabelClassName?: string;
}

/**
 * Single-thumb slider built on Radix `Slider`. Track is a 1.5px-tall muted
 * pill; the selected range fills with accent; the 16px thumb is an accent circle
 * with a white border and card shadow. Pass `showValue` for a trailing
 * tabular-nums readout.
 */
export const RangeSlider = forwardRef<
  ComponentRef<typeof SliderPrimitive.Root>,
  RangeSliderProps
>(function RangeSlider(
  {
    className,
    wrapperClassName,
    valueLabelClassName,
    value,
    defaultValue,
    onValueChange,
    showValue = false,
    formatValue,
    min = 0,
    max = 100,
    step = 1,
    "aria-label": ariaLabel,
    ...props
  },
  ref,
) {
  // Radix uses arrays for (potentially) multi-thumb sliders; we expose a single
  // scalar to the caller for the common one-thumb case.
  const isControlled = value !== undefined;
  // Track the value internally so the `showValue` label follows the thumb in
  // UNCONTROLLED mode too (where there is no `value` prop to read). In controlled
  // mode the `value` prop is the source of truth and this state is ignored.
  const [internalValue, setInternalValue] = useState(defaultValue ?? min);
  const currentValue = isControlled ? value : internalValue;
  const labelText = formatValue
    ? formatValue(currentValue)
    : String(currentValue);

  return (
    <div className={cn("flex items-center gap-3", wrapperClassName)}>
      <SliderPrimitive.Root
        ref={ref}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
        value={value === undefined ? undefined : [value]}
        defaultValue={defaultValue === undefined ? undefined : [defaultValue]}
        onValueChange={(next) => {
          if (next.length === 0) return;
          if (!isControlled) setInternalValue(next[0]);
          onValueChange?.(next[0]);
        }}
        className={cn(
          "relative flex flex-1 cursor-pointer touch-none select-none items-center",
          className,
        )}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-muted">
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-accent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          aria-label={ariaLabel}
          className="block h-4 w-4 rounded-full border-2 border-white bg-accent shadow-card outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-muted)]"
        />
      </SliderPrimitive.Root>
      {showValue ? (
        <span
          className={cn(
            "text-right text-body tabular-nums text-text-muted",
            valueLabelClassName ?? "w-7",
          )}
        >
          {labelText}
        </span>
      ) : null}
    </div>
  );
});
