"use client";

import { forwardRef, useId } from "react";
import type {
  ComponentPropsWithoutRef,
  ComponentRef,
  ReactNode,
} from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

type RadioRootProps = ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>;
type RadioItemProps = ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>;

/**
 * Radio group container (Radix). Vertically stacks `RadioRow`s by default;
 * pass `className` to switch to a horizontal layout. Controlled via
 * `value` / `onValueChange`.
 */
export const RadioGroup = forwardRef<
  ComponentRef<typeof RadioGroupPrimitive.Root>,
  RadioRootProps
>(function RadioGroup({ className, ...props }, ref) {
  return (
    <RadioGroupPrimitive.Root
      ref={ref}
      className={cn("flex flex-col gap-2", className)}
      {...props}
    />
  );
});

export interface RadioRowProps extends Omit<RadioItemProps, "children"> {
  /** Primary label text. */
  label: ReactNode;
  /** Optional muted sub-text (12px). */
  subText?: ReactNode;
  /** Wrapper class for the label row. */
  wrapperClassName?: string;
}

/**
 * One selectable radio row: a 16px Radix radio with an accent inner dot when
 * selected, plus a clickable label (and optional sub-text). Use inside
 * `RadioGroup`.
 */
export const RadioRow = forwardRef<
  ComponentRef<typeof RadioGroupPrimitive.Item>,
  RadioRowProps
>(function RadioRow(
  { label, subText, wrapperClassName, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const itemId = id ?? generatedId;
  return (
    <label
      htmlFor={itemId}
      className={cn(
        "flex cursor-pointer items-start gap-2 text-[13px] text-text-soft",
        wrapperClassName,
      )}
    >
      <RadioGroupPrimitive.Item
        ref={ref}
        id={itemId}
        className={cn(
          "mt-px flex h-4 w-4 flex-none cursor-pointer items-center justify-center rounded-full border border-border-strong bg-surface transition-colors",
          "data-[state=checked]:border-accent",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <RadioGroupPrimitive.Indicator className="block h-[8px] w-[8px] rounded-full bg-accent" />
      </RadioGroupPrimitive.Item>
      <span className="flex flex-col gap-0.5">
        <span>{label}</span>
        {subText ? (
          <span className="text-[12px] text-text-muted">{subText}</span>
        ) : null}
      </span>
    </label>
  );
});

export interface RadioOption<T extends string> {
  value: T;
  label: ReactNode;
  subText?: ReactNode;
  disabled?: boolean;
}

export interface TypedRadioGroupProps<T extends string> {
  options: RadioOption<T>[];
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  className?: string;
  "aria-label"?: string;
  name?: string;
}

/**
 * Convenience wrapper: render a `RadioGroup` from a typed options array. Emits
 * the selected value (typed as `T`) via `onValueChange`.
 */
export function TypedRadioGroup<T extends string>({
  options,
  value,
  defaultValue,
  onValueChange,
  className,
  name,
  "aria-label": ariaLabel,
}: TypedRadioGroupProps<T>) {
  return (
    <RadioGroup
      aria-label={ariaLabel}
      name={name}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(next) => onValueChange?.(next as T)}
      className={className}
    >
      {options.map((option) => (
        <RadioRow
          key={option.value}
          value={option.value}
          label={option.label}
          subText={option.subText}
          disabled={option.disabled}
        />
      ))}
    </RadioGroup>
  );
}
