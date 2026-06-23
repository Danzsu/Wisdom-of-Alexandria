import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Custom tailwind-merge instance that knows about the Alexandria semantic type
 * scale tokens (text-micro / tiny / small / body / field / lead / title /
 * display / hero). Without this, tailwind-merge treats them as unknown text-*
 * classes and may drop colour utilities like text-pov3-tx when merging.
 * By registering them in the font-size group they co-exist with text-colour
 * classes — matching how Tailwind v4 generates them from `--text-*` in @theme.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-micro",
        "text-tiny",
        "text-small",
        "text-body",
        "text-field",
        "text-lead",
        "text-title",
        "text-display",
        "text-hero",
      ],
    },
  },
});

/**
 * Merge conditional class names (clsx) and de-duplicate conflicting Tailwind
 * utilities (tailwind-merge). Used by every kit primitive so later utility
 * overrides win predictably.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format an integer with Hungarian thousands grouping (a regular space between
 * groups, e.g. `1482` → `1 482`), matching the prototype's word-count display.
 * A manual grouping (not `Intl.NumberFormat`) keeps the separator deterministic
 * across runtimes — `Intl`'s ICU data varies (NBSP / no separator) per
 * environment, which would make the rendered number untestable.
 */
export function formatHu(n: number): string {
  return Math.trunc(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/**
 * Count words in a plain-text string the same way the backend does
 * (`content.split()` → whitespace-separated, ignoring empty tokens). Keeping the
 * algorithm identical means the live editor count matches the persisted
 * `word_count` the server returns.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}
