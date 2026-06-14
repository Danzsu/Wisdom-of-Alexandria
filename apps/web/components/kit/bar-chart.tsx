import { cn } from "@/lib/utils";

export interface BarChartDatum {
  /** X-axis label under the bar. */
  label: string;
  /** Bar height as a percentage 0–100 of the chart height. */
  value: number;
  /** Render as a dashed "planned" placeholder bar. */
  planned?: boolean;
  /** Tooltip text (defaults to `label`). */
  title?: string;
}

export interface BarChartProps {
  /** The bars, left to right. */
  data: BarChartDatum[];
  /** Chart body height in px. */
  height?: number;
  className?: string;
  /** Accessible chart description. */
  "aria-label"?: string;
}

/** Clamp a percentage into the 0–100 range. */
function clampPct(value: number): number {
  return Math.min(100, Math.max(0, value));
}

/**
 * Hand-rolled vertical bar chart. Bars grow from the baseline with the
 * `woaGrow` entrance, capped at 46px wide, gold gradient fill. `planned` bars
 * render as dashed outlines with faint labels.
 */
export function BarChart({
  data,
  height = 120,
  className,
  "aria-label": ariaLabel,
}: BarChartProps) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn("flex flex-col gap-2", className)}
    >
      <div className="flex items-end gap-3.5" style={{ height }}>
        {data.map((datum) => {
          const pct = clampPct(datum.value);
          return (
            <div
              key={datum.label}
              className="flex flex-1 flex-col items-center justify-end"
              style={{ height: "100%" }}
            >
              <div
                title={datum.title ?? datum.label}
                className={cn(
                  "w-full max-w-[46px] origin-bottom rounded-t-[7px] [animation:woaGrow_.5s_ease]",
                  datum.planned
                    ? "border border-dashed border-border-strong bg-surface-muted"
                    : "bg-[linear-gradient(180deg,var(--accent),#b8893f)]",
                )}
                style={{ height: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-3.5">
        {data.map((datum) => (
          <span
            key={datum.label}
            className={cn(
              "flex-1 text-center text-[11px]",
              datum.planned ? "text-text-faint" : "text-text-muted",
            )}
          >
            {datum.label}
          </span>
        ))}
      </div>
    </div>
  );
}
