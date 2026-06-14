import { cn } from "@/lib/utils";

export interface SpinnerProps {
  /** Diameter in px (14–15 in use; default 15). */
  size?: number;
  /** Arc colour: `ai` (default) or `accent`. */
  variant?: "ai" | "accent";
  /** Accessible status label. */
  label?: string;
  className?: string;
}

/**
 * Small spinning arc loader (`woaSpin`). Exposed as a live status region with
 * an accessible label so screen readers announce the busy state.
 */
export function Spinner({
  size = 15,
  variant = "ai",
  label = "Betöltés",
  className,
}: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn("inline-flex", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={variant === "accent" ? "var(--accent)" : "var(--ai)"}
        strokeWidth={2}
        strokeLinecap="round"
        aria-hidden="true"
        className="[animation:woaSpin_1s_linear_infinite]"
      >
        <path d="M21 12a9 9 0 1 1-6.2-8.6" />
      </svg>
    </span>
  );
}
