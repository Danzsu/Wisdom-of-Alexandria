/**
 * Shared cover-gradient strings for book covers / spines and gradient card
 * headers. These are the one documented exception to the "tokens not raw hex"
 * rule: the gold/blue-grey covers blend `var(--accent)` with darker stops that
 * have no token of their own, so the literals live here in ONE place (imported
 * by `kit/card.tsx` and `kit/book-spine-card.tsx`) rather than being duplicated.
 */
export const COVER_GRADIENT: Record<"gold" | "blueGrey", string> = {
  gold: "linear-gradient(150deg,var(--accent) 0%,#b8893f 55%,#8a6a2e 100%)",
  blueGrey: "linear-gradient(150deg,#5b7a8c 0%,#42606f 60%,#2f4855 100%)",
};

/** Cover gradient variant key. */
export type CoverGradientVariant = keyof typeof COVER_GRADIENT;
