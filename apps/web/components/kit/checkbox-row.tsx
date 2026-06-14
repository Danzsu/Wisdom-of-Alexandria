"use client";

import { forwardRef, useId, useState } from "react";
import type {
  ComponentPropsWithoutRef,
  ComponentRef,
  ReactNode,
} from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { Card } from "./card";

type CheckboxRootProps = ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>;

/** Bare 16px Radix checkbox box with the accent-fill + white check styling. */
const CheckBox = forwardRef<
  ComponentRef<typeof CheckboxPrimitive.Root>,
  CheckboxRootProps
>(function CheckBox({ className, ...props }, ref) {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      className={cn(
        "flex h-4 w-4 flex-none cursor-pointer items-center justify-center rounded-[4px] border border-border-strong bg-surface transition-colors",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="text-accent-fg">
        <Icon icon={Check} size={12} className="stroke-[3]" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});

export interface CheckboxRowProps extends Omit<CheckboxRootProps, "children"> {
  /** Primary label text. */
  label: ReactNode;
  /** Optional secondary sub-text (12px muted). */
  subText?: ReactNode;
  /** Wrapper class for the label row. */
  wrapperClassName?: string;
}

/**
 * A labelled checkbox row: 16px Radix checkbox + a label (and optional muted
 * sub-text) wrapped in a `<label>` so the whole row is clickable. The checked
 * box fills with accent and shows a white check.
 */
export const CheckboxRow = forwardRef<
  ComponentRef<typeof CheckboxPrimitive.Root>,
  CheckboxRowProps
>(function CheckboxRow({ label, subText, wrapperClassName, id, ...props }, ref) {
  const generatedId = useId();
  const boxId = id ?? generatedId;
  return (
    <label
      htmlFor={boxId}
      className={cn(
        "flex cursor-pointer items-start gap-2 text-[13px] text-text-soft",
        wrapperClassName,
      )}
    >
      <CheckBox ref={ref} id={boxId} className="mt-px" {...props} />
      <span className="flex flex-col gap-0.5">
        <span>{label}</span>
        {subText ? (
          <span className="text-[12px] text-text-muted">{subText}</span>
        ) : null}
      </span>
    </label>
  );
});

export interface SelectableCheckboxCardProps
  extends Omit<CheckboxRootProps, "children" | "title"> {
  /** Primary title. */
  title: ReactNode;
  /** Optional muted sub-title (e.g. "Karakter · 3 említés"). */
  subTitle?: ReactNode;
  /** Optional leading slot (avatar or icon). */
  leading?: ReactNode;
  /** Wrapper class for the label-wrapped card. */
  wrapperClassName?: string;
}

/**
 * A `<label>`-wrapped Card that toggles a hidden Radix checkbox. When checked it
 * enters the Card `selected` state (accent border + accent-muted bg). Used by
 * the AI extract-entities list and the new-Codex track selector.
 */
export const SelectableCheckboxCard = forwardRef<
  ComponentRef<typeof CheckboxPrimitive.Root>,
  SelectableCheckboxCardProps
>(function SelectableCheckboxCard(
  {
    title,
    subTitle,
    leading,
    wrapperClassName,
    id,
    checked,
    defaultChecked,
    onCheckedChange,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const boxId = id ?? generatedId;
  const isControlled = checked !== undefined;
  // Track the visual selected state internally for the uncontrolled case so the
  // card border reacts to clicks; controlled usage reads straight from `checked`.
  const [internalChecked, setInternalChecked] = useState(
    defaultChecked === true,
  );
  const selected = isControlled ? checked === true : internalChecked;

  return (
    <label htmlFor={boxId} className={cn("block cursor-pointer", wrapperClassName)}>
      <Card
        selected={selected}
        className="flex items-center gap-2.5 px-[13px] py-[11px]"
      >
        <CheckBox
          ref={ref}
          id={boxId}
          checked={checked}
          defaultChecked={defaultChecked}
          onCheckedChange={(next) => {
            if (!isControlled) setInternalChecked(next === true);
            onCheckedChange?.(next);
          }}
          {...props}
        />
        {leading}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-semibold text-text">{title}</span>
          {subTitle ? (
            <span className="text-[11px] text-text-muted">{subTitle}</span>
          ) : null}
        </span>
      </Card>
    </label>
  );
});

export { CheckBox };
