import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { povSlot, type PovSlot } from "@/lib/pov-color";
import { StatusDot, type StatusDotVariant } from "./status-dot";

/** Supported avatar diameters (px). */
export type AvatarSize = 21 | 24 | 28 | 30 | 34 | 38 | 56 | 60;

/** Explicit colour scheme; `pov` is derived from the name when omitted. */
export type AvatarColor = PovSlot | "accent" | "ai";

const SIZE_CLASS: Record<AvatarSize, string> = {
  21: "h-[21px] w-[21px] text-[9px] font-bold",
  24: "h-6 w-6 text-[10px] font-bold",
  28: "h-7 w-7 text-[11px] font-bold",
  30: "h-[30px] w-[30px] text-[11px] font-bold",
  34: "h-[34px] w-[34px] text-[12px] font-bold",
  38: "h-[38px] w-[38px] text-[13px] font-bold",
  56: "h-14 w-14 text-[18px] font-bold",
  60: "h-[60px] w-[60px] text-[20px] font-bold",
};

const COLOR_CLASS: Record<AvatarColor, string> = {
  1: "bg-pov1-bg text-pov1-tx",
  2: "bg-pov2-bg text-pov2-tx",
  3: "bg-pov3-bg text-pov3-tx",
  4: "bg-pov4-bg text-pov4-tx",
  5: "bg-pov5-bg text-pov5-tx",
  6: "bg-pov6-bg text-pov6-tx",
  accent: "bg-accent-strong text-accent-fg",
  ai: "bg-ai-muted text-ai-text",
};

/** Build the 1–2 char initials from a name. */
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, "color"> {
  /** Character/person name — drives initials and (when `color` is unset) POV colour. */
  name?: string;
  /** Explicit initials override (otherwise derived from `name`). */
  initials?: string;
  /** Diameter in px. */
  size?: AvatarSize;
  /** Colour scheme; defaults to the deterministic POV colour of `name`. */
  color?: AvatarColor;
  /**
   * `stack` overlaps within a group (negative margin + surface ring); `graph`
   * adds a surface ring + panel shadow for graph nodes.
   */
  variant?: "default" | "stack" | "graph";
  /** Optional presence dot in the bottom-right corner. */
  presence?: StatusDotVariant;
}

/**
 * Circular initials avatar. When `color` is omitted the colour is derived
 * deterministically from `name` (pov1..pov6), so a person is always the same
 * hue. `stack` overlaps in a row; `graph` styles a graph node; `presence`
 * adds a corner status dot.
 */
export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  {
    className,
    name,
    initials,
    size = 30,
    color,
    variant = "default",
    presence,
    ...props
  },
  ref,
) {
  const resolvedColor: AvatarColor = color ?? (name ? povSlot(name) : "accent");
  const text = initials ?? (name ? initialsFrom(name) : "?");
  const hasPresence = Boolean(presence);
  return (
    <span
      ref={ref}
      title={name}
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-full",
        SIZE_CLASS[size],
        COLOR_CLASS[resolvedColor],
        variant === "stack" && "-ml-[7px] border-[1.5px] border-surface",
        variant === "graph" && "border-[3px] border-surface shadow-panel",
        hasPresence && "relative",
        className,
      )}
      {...props}
    >
      {text}
      {presence ? (
        <StatusDot
          variant={presence}
          treatment="presence"
          className="absolute -bottom-px -right-px"
        />
      ) : null}
    </span>
  );
});
