import type { SVGProps } from "react";

/** 8-point brand star path (TopBar mark). */
const BRAND_PATH = "M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4Z";
/** 4-point AI sparkle path used to flag AI-generated affordances. */
const SPARKLE_PATH = "M12 3l1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9Z";

export interface BrandStarProps
  extends Omit<SVGProps<SVGSVGElement>, "fill"> {
  /** Rendered square size in px. */
  size?: number;
  /** Accessible name; when set the star is exposed as an image instead of decorative. */
  title?: string;
  /**
   * `brand` → 8-point gold star (default). `sparkle` → 4-point AI star filled
   * with the AI token, used as the AI affordance glyph.
   */
  variant?: "brand" | "sparkle";
}

/**
 * Alexandria star mark. The `brand` variant is the gold 8-point logo; the
 * `sparkle` variant is the 4-point AI glyph (blue `--ai` fill). Paths are taken
 * verbatim from the prototype. A `title` makes it an accessible image; without
 * one it is hidden from assistive tech.
 */
export function BrandStar({
  size = 19,
  title,
  variant = "brand",
  ...props
}: BrandStarProps) {
  const isSparkle = variant === "sparkle";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isSparkle ? "var(--ai)" : "var(--accent)"}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path d={isSparkle ? SPARKLE_PATH : BRAND_PATH} />
    </svg>
  );
}
