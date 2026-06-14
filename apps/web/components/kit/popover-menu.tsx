"use client";

import { forwardRef } from "react";
import type {
  ComponentPropsWithoutRef,
  ComponentRef,
  ReactNode,
} from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { SectionEyebrow } from "./section-eyebrow";

/* ============================================================================
   PopoverMenu — a trigger-anchored menu built on Radix DropdownMenu.
   Keyboard nav, focus management and roving tabindex come from Radix.
   ========================================================================== */

/** Root: wires open state. Use `PopoverMenuTrigger` + `PopoverMenuContent`. */
export const PopoverMenu = DropdownMenuPrimitive.Root;

/** Trigger element. Pass `asChild` to use your own button. */
export const PopoverMenuTrigger = DropdownMenuPrimitive.Trigger;

/** Shared surface styling for both the dropdown menu and the rich popover. */
const SURFACE =
  "z-50 flex flex-col gap-px rounded-xl border border-border bg-surface p-[5px] shadow-popover " +
  "data-[state=open]:[animation:woaToastIn_.15s_ease-out]";

type MenuContentProps = ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Content
>;

/**
 * Menu surface (portalled). 12px radius, popover shadow, 5px padding, 1px gap
 * column, `woaToastIn` entrance, min-width 184. Renders inside a Radix Portal so
 * it escapes overflow contexts.
 */
export const PopoverMenuContent = forwardRef<
  ComponentRef<typeof DropdownMenuPrimitive.Content>,
  MenuContentProps
>(function PopoverMenuContent(
  { className, sideOffset = 6, align = "start", ...props },
  ref,
) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn(SURFACE, "min-w-[184px]", className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
});

const menuRowVariants = cva(
  "flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] outline-none transition-colors " +
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
  {
    variants: {
      variant: {
        default:
          "text-text-soft hover:bg-surface-muted hover:text-text focus:bg-surface-muted focus:text-text data-[highlighted]:bg-surface-muted data-[highlighted]:text-text",
        danger:
          "text-danger-text hover:bg-danger-muted focus:bg-danger-muted data-[highlighted]:bg-danger-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

type MenuItemProps = ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Item
> &
  VariantProps<typeof menuRowVariants> & {
    /** Leading 14–15px accent icon slot. */
    leadingIcon?: ReactNode;
    /** Trailing slot (badge / dot / subtitle), pushed to the right. */
    trailing?: ReactNode;
  };

/**
 * One menu row. 13px text-soft, leading accent icon slot + optional trailing
 * slot. Hover/keyboard-highlight tints the surface; `variant="danger"` switches
 * to danger text + danger-muted hover. Selection semantics come from Radix.
 */
export const MenuRow = forwardRef<
  ComponentRef<typeof DropdownMenuPrimitive.Item>,
  MenuItemProps
>(function MenuRow(
  { className, variant, leadingIcon, trailing, children, ...props },
  ref,
) {
  return (
    <DropdownMenuPrimitive.Item
      ref={ref}
      className={cn(menuRowVariants({ variant }), className)}
      {...props}
    >
      {leadingIcon ? (
        <span className="flex flex-none items-center text-accent">
          {leadingIcon}
        </span>
      ) : null}
      <span className="flex-1 truncate">{children}</span>
      {trailing ? (
        <span className="flex flex-none items-center">{trailing}</span>
      ) : null}
    </DropdownMenuPrimitive.Item>
  );
});

export interface MenuSectionProps {
  /** Section label text. */
  label: ReactNode;
  className?: string;
}

/** Faint uppercase section label inside a menu (reuses `SectionEyebrow`). */
export function MenuSection({ label, className }: MenuSectionProps) {
  return (
    <DropdownMenuPrimitive.Label asChild>
      <SectionEyebrow
        tone="faint"
        className={cn("px-2.5 pb-1 pt-1.5 text-[10px]", className)}
      >
        {label}
      </SectionEyebrow>
    </DropdownMenuPrimitive.Label>
  );
}

/** Thin divider between menu groups. */
export const MenuSeparator = forwardRef<
  ComponentRef<typeof DropdownMenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(function MenuSeparator({ className, ...props }, ref) {
  return (
    <DropdownMenuPrimitive.Separator
      ref={ref}
      className={cn("mx-1.5 my-[3px] h-px bg-border", className)}
      {...props}
    />
  );
});

/* ============================================================================
   PopoverPanel — a generic rich (non-menu) popover on Radix Popover, sharing
   the same surface styling. For the Format menu etc.
   ========================================================================== */

/** Root for a rich popover. */
export const Popover = PopoverPrimitive.Root;
/** Trigger for a rich popover. */
export const PopoverTrigger = PopoverPrimitive.Trigger;
/** Anchor for a rich popover (optional). */
export const PopoverAnchor = PopoverPrimitive.Anchor;

type PopoverContentProps = ComponentPropsWithoutRef<
  typeof PopoverPrimitive.Content
>;

/**
 * Rich popover panel (portalled) sharing the menu surface styling but holding
 * arbitrary content rather than menu rows. The default padding is removed so
 * callers control their own layout.
 */
export const PopoverPanel = forwardRef<
  ComponentRef<typeof PopoverPrimitive.Content>,
  PopoverContentProps
>(function PopoverPanel(
  { className, sideOffset = 6, align = "start", ...props },
  ref,
) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        align={align}
        className={cn(SURFACE, "p-3", className)}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
});

export { menuRowVariants };
