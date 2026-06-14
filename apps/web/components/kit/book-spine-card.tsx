import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { BookOpen, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

/** Cover sizes (w×h px). */
export type BookSpineSize = "sm" | "grid" | "wizard";

const SIZE_CLASS: Record<BookSpineSize, string> = {
  sm: "w-10 h-14", // 40×56
  grid: "h-[88px] w-[62px]", // 88-tall grid thumbnail
  wizard: "h-[106px] w-[76px]", // 76×106 wizard cover
};

const GRADIENT: Record<"gold" | "blueGrey", string> = {
  gold: "linear-gradient(150deg,var(--accent) 0%,#b8893f 55%,#8a6a2e 100%)",
  blueGrey: "linear-gradient(150deg,#5b7a8c 0%,#42606f 60%,#2f4855 100%)",
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
      background: GRADIENT[variant],
      boxShadow:
        "inset 0 0 0 2px rgba(255,255,255,.12), inset 2px 0 0 rgba(0,0,0,.12), var(--shadow-card)",
    };
    const textColor =
      variant === "gold" ? "text-accent-fg" : "text-white/85";
    return (
      <div
        ref={ref}
        role="img"
        aria-label={title}
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
