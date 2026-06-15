import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { BookOpen, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { COVER_GRADIENT } from "@/lib/gradients";
import { Icon } from "./icon";

/** Cover sizes (w×h px). */
export type BookSpineSize = "sm" | "grid" | "wizard";

const SIZE_CLASS: Record<BookSpineSize, string> = {
  sm: "w-10 h-14", // 40×56
  grid: "h-[88px] w-[62px]", // 88-tall grid thumbnail
  wizard: "h-[106px] w-[76px]", // 76×106 wizard cover
};

export interface BookSpineCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Cover size token. */
  size?: BookSpineSize;
  /** Gradient treatment. */
  variant?: "gold" | "blueGrey";
  /** Bottom-centre glyph: `book` (default) or `star`. */
  glyph?: "book" | "star";
  /** Book title — used as the accessible label / alt. */
  title?: string;
}

/**
 * Stylised book cover / spine. Gold gradient by default (blue-grey alt),
 * inset highlight + shadow, with a book or star glyph centred at the bottom.
 * Three sizes: `sm`, `grid`, `wizard`.
 */
export const BookSpineCard = forwardRef<HTMLDivElement, BookSpineCardProps>(
  function BookSpineCard(
    { className, size = "grid", variant = "gold", glyph = "book", title, ...props },
    ref,
  ) {
    const style: CSSProperties = {
      background: COVER_GRADIENT[variant],
      boxShadow:
        "inset 0 0 0 2px rgba(255,255,255,.12), inset 2px 0 0 rgba(0,0,0,.12), var(--shadow-card)",
    };
    const textColor =
      variant === "gold" ? "text-accent-fg" : "text-white/85";
    // With a title the card is a labelled image; without one it is purely
    // decorative, so mark it aria-hidden rather than shipping an unlabelled
    // `role="img"` with `aria-label={undefined}`.
    const a11yProps = title
      ? ({ role: "img", "aria-label": title } as const)
      : ({ "aria-hidden": true } as const);
    return (
      <div
        ref={ref}
        {...a11yProps}
        className={cn(
          "flex flex-none items-end justify-center rounded-md border border-accent pb-1.5",
          SIZE_CLASS[size],
          textColor,
          className,
        )}
        style={style}
        {...props}
      >
        <Icon icon={glyph === "star" ? Star : BookOpen} size={16} />
      </div>
    );
  },
);

/** Alias: a CoverThumbnail is the same primitive, intent-named. */
export const CoverThumbnail = BookSpineCard;
