"use client";

import { forwardRef, useId } from "react";
import type { ComponentPropsWithoutRef, ComponentRef, ReactNode } from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { cn } from "@/lib/utils";

type SwitchRootProps = ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>;

export interface ToggleSwitchProps
  extends Omit<SwitchRootProps, "children"> {
  /** Track size: `md` 40×23 (default) or `sm` 36×20. */
  size?: "md" | "sm";
  /** Optional visible label rendered to the right of the track. */
  label?: ReactNode;
  /** Wrapper class for the label+track row. */
  wrapperClassName?: string;
}

const TRACK: Record<NonNullable<ToggleSwitchProps["size"]>, string> = {
  md: "h-[23px] w-10",
  sm: "h-5 w-9",
};

const THUMB: Record<NonNullable<ToggleSwitchProps["size"]>, string> = {
  // md: 17px knob travels 40-17-2*2 = 19px; sm: 15px knob travels 36-15-2*2 = 17px.
  md: "h-[17px] w-[17px] translate-x-0.5 data-[state=checked]:translate-x-[20px]",
  sm: "h-[15px] w-[15px] translate-x-0.5 data-[state=checked]:translate-x-[18px]",
};

/**
 * On/off switch built on Radix `Switch`. Off: muted surface track with a
 * border; on: accent track. The white knob has a card shadow and slides to the
 * end when checked. Pass `label` for an inline caption; Radix wires the
 * `role="switch"` + `aria-checked` semantics.
 */
export const ToggleSwitch = forwardRef<
  ComponentRef<typeof SwitchPrimitive.Root>,
  ToggleSwitchProps
>(function ToggleSwitch(
  { className, wrapperClassName, size = "md", label, id, ...props },
  ref,
) {
  const generatedId = useId();
  const switchId = id ?? generatedId;
  const track = (
    <SwitchPrimitive.Root
      ref={ref}
      id={switchId}
      className={cn(
        "inline-flex flex-none cursor-pointer items-center rounded-full border transition-colors",
        "border-border bg-surface-muted",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        TRACK[size],
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block rounded-full bg-white shadow-card transition-transform",
          THUMB[size],
        )}
      />
    </SwitchPrimitive.Root>
  );

  if (!label) return track;

  return (
    <div className={cn("flex items-center gap-2.5", wrapperClassName)}>
      {track}
      <label
        htmlFor={switchId}
        className="cursor-pointer text-body text-text-soft"
      >
        {label}
      </label>
    </div>
  );
});
