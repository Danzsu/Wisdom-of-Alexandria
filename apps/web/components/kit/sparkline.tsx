import { useId } from "react";
import { cn } from "@/lib/utils";

export interface SparklineProps {
  /** Y values; mapped across the fixed 240×110 viewBox. */
  data: number[];
  className?: string;
  /** Accessible description. */
  "aria-label"?: string;
}

const VIEW_W = 240;
const VIEW_H = 110;
// Leave headroom so the stroke and end dot are never clipped.
const PAD_TOP = 14;
const PAD_BOTTOM = 14;

/**
 * Compute the `M…L…` path string for the data line within the viewBox. Returns
 * empty strings when there are too few points to draw.
 */
function buildPaths(data: number[]): { line: string; area: string } {
  if (data.length < 2) return { line: "", area: "" };
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const stepX = VIEW_W / (data.length - 1);
  const usableH = VIEW_H - PAD_TOP - PAD_BOTTOM;

  const points = data.map((value, index) => {
    const x = index * stepX;
    const y = PAD_TOP + (1 - (value - min) / span) * usableH;
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x} ${y}`)
    .join(" ");
  const area = `${line} L${VIEW_W} ${VIEW_H} L0 ${VIEW_H} Z`;
  return { line, area };
}

/**
 * Hand-rolled sparkline: a 240×110 SVG with a gradient area fill (.28 → 0), a
 * 2.5px accent stroke, and a dot on the final point. No chart library.
 */
export function Sparkline({
  data,
  className,
  "aria-label": ariaLabel,
}: SparklineProps) {
  const gradientId = useId();
  const { line, area } = buildPaths(data);

  // End-point coordinates for the trailing dot.
  let endX = 0;
  let endY = 0;
  if (data.length >= 2) {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const span = max - min || 1;
    const usableH = VIEW_H - PAD_TOP - PAD_BOTTOM;
    endX = VIEW_W;
    endY = PAD_TOP + (1 - (data[data.length - 1] - min) / span) * usableH;
  }

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel}
      className={cn("block w-full", className)}
      style={{ height: 104 }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.28" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {area ? <path d={area} fill={`url(#${gradientId})`} /> : null}
      {line ? (
        <path
          d={line}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {line ? (
        <circle cx={endX} cy={endY} r={3.5} fill="var(--accent-strong)" />
      ) : null}
    </svg>
  );
}
