"use client";

/**
 * Select — a thin Radix Select wrapper styled to match FormInput (36px, rounded-md,
 * accent focus ring). Portalled content with shadow-popover; check icon on the
 * selected item. Keyboard-operable; axe-clean.
 */

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { Icon } from "./icon";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  /** The currently selected value (controlled). */
  value: string;
  /** Fired when the user picks a new option. */
  onValueChange: (value: string) => void;
  /** Options to display. */
  options: SelectOption[];
  /** Placeholder shown when value is empty. */
  placeholder?: string;
  /** Accessible label for the trigger (paired with a visible FieldLabel via `aria-labelledby` in callers). */
  "aria-label"?: string;
  /** Disable the control. */
  disabled?: boolean;
  /** Extra class on the trigger. */
  className?: string;
}

/**
 * Controlled select built on Radix Select. The trigger is styled to match
 * FormInput: 36px height, 8px radius, `border-border`, `bg-surface`, and the
 * same accent focus ring (`focus-visible:border-accent focus-visible:shadow-[…]`).
 *
 * The trigger exposes `role="combobox"` (Radix default). Items in the portalled
 * listbox expose `role="option"`. Use `aria-label` on the component, or pair with
 * a `FieldLabel` whose `htmlFor` targets the trigger's id and whose `id` is passed
 * as `aria-labelledby` (since Radix Select trigger is not a native control, the
 * native `for`/`id` association doesn't work — use `aria-label` instead).
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Válassz…",
  "aria-label": ariaLabel,
  disabled,
  className,
}: SelectProps) {
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          // Dimensions + shape: matches FormInput (h-9 = 36px)
          "inline-flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3",
          // Typography
          "font-sans text-field text-text",
          // Placeholder colour
          "data-[placeholder]:text-text-faint",
          // Focus ring identical to FormInput
          "outline-none focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-muted)]",
          // Disabled
          "disabled:cursor-not-allowed disabled:opacity-50",
          // State
          "data-[state=open]:border-accent",
          // Transitions
          "transition-colors",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <Icon icon={ChevronDown} size={14} className="flex-none text-text-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className={cn(
            // Surface
            "z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-surface",
            // Shadow + reduced-motion-safe entrance (mirrors popover-menu.tsx)
            "shadow-popover",
            "data-[state=open]:[animation:woaToastIn_.15s_ease-out]",
            "@media(prefers-reduced-motion:reduce):[animation:none]",
          )}
        >
          <SelectPrimitive.Viewport className="p-[5px]">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className={cn(
                  "relative flex cursor-pointer select-none items-center rounded-lg px-2.5 py-2 pr-8 text-body text-text-soft outline-none",
                  "focus:bg-surface-muted focus:text-text",
                  "data-[highlighted]:bg-surface-muted data-[highlighted]:text-text",
                  "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                )}
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 flex items-center">
                  <Icon icon={Check} size={13} className="text-accent" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
