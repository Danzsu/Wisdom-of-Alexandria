import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names (clsx) and de-duplicate conflicting Tailwind
 * utilities (tailwind-merge). Used by every kit primitive so later utility
 * overrides win predictably.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
