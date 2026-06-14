import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** CSS width (number → px, or any CSS length). Defaults to full width. */
  width?: number | string;
  /** CSS height (number → px). Defaults to a 9px line. */
  height?: number | string;
}

/** Coerce a number to a px string, pass strings through. */
function toCssSize(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

/**
 * Shimmering placeholder block (`.woa-skel`). Configure `width`/`height`;
 * defaults to a 9px-tall full-width line. Marked aria-hidden — it is purely a
 * loading affordance.
 */
export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  function Skeleton({ className, width, height = 9, style, ...props }, ref) {
    const sizeStyle: CSSProperties = {
      width: toCssSize(width),
      height: toCssSize(height),
      ...style,
    };
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={cn("woa-skel", width === undefined && "w-full", className)}
        style={sizeStyle}
        {...props}
      />
    );
  },
);
