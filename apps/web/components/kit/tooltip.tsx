"use client";

import { forwardRef } from "react";
import type {
  ComponentPropsWithoutRef,
  ComponentRef,
  ReactNode,
} from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Mount once near the root so all tooltips share a delay timer. */
export function TooltipProvider({
  children,
  delayDuration = 300,
  ...props
}: ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration} {...props}>
      {children}
    </TooltipPrimitive.Provider>
  );
}

export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

const tooltipContentVariants = cva(
  "z-50 max-w-xs rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug shadow-popover " +
    "data-[state=delayed-open]:[animation:woaFade_.12s_ease-out]",
  {
    variants: {
      tone: {
        // Light surface tooltip (default).
        surface: "border-border bg-surface text-text-soft",
        // Inverted dark tooltip (text-coloured bg).
        dark: "border-text bg-text text-bg",
      },
    },
    defaultVariants: {
      tone: "surface",
    },
  },
);

type TooltipContentProps = ComponentPropsWithoutRef<
  typeof TooltipPrimitive.Content
> &
  VariantProps<typeof tooltipContentVariants>;

/** Themed tooltip content (portalled). */
export const TooltipContent = forwardRef<
  ComponentRef<typeof TooltipPrimitive.Content>,
  TooltipContentProps
>(function TooltipContent(
  { className, tone, sideOffset = 6, children, ...props },
  ref,
) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        className={cn(tooltipContentVariants({ tone }), className)}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
});

export interface TooltipProps {
  /** Trigger element (wrapped via `asChild`). */
  children: ReactNode;
  /** Tooltip body. */
  content: ReactNode;
  /** Visual tone. */
  tone?: "surface" | "dark";
  /** Placement side. */
  side?: "top" | "right" | "bottom" | "left";
  /** Per-tooltip delay override. */
  delayDuration?: number;
}

/**
 * Convenience tooltip: wrap any element and supply `content`. Requires a
 * `TooltipProvider` higher in the tree. Defaults to the light surface tone.
 */
export function Tooltip({
  children,
  content,
  tone,
  side = "top",
  delayDuration,
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipContent tone={tone} side={side}>
        {content}
      </TooltipContent>
    </TooltipPrimitive.Root>
  );
}

export { tooltipContentVariants };
