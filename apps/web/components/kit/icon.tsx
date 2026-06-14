import { forwardRef } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

export interface IconProps extends Omit<LucideProps, "ref"> {
  /** Any Lucide icon component, e.g. `Search` from `lucide-react`. */
  icon: LucideIcon;
  /** Square size in px (11–19 in use; default 16). */
  size?: number;
}

/**
 * Thin, consistent wrapper around a Lucide icon: stroke-width 1.75, round caps
 * and joins, `currentColor` stroke. Pass any Lucide component via `icon`.
 * Decorative by default (`aria-hidden`); pass `aria-label` to expose it.
 */
export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { icon: LucideGlyph, size = 16, "aria-label": ariaLabel, ...props },
  ref,
) {
  return (
    <LucideGlyph
      ref={ref}
      size={size}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      {...props}
    />
  );
});
