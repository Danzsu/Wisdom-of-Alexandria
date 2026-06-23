import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* SkeletonCard                                                                */
/* -------------------------------------------------------------------------- */

export interface SkeletonCardProps {
  className?: string;
}

/**
 * A card-shaped loading placeholder: title line + 2 body lines.
 * Purely decorative — aria-hidden.
 */
export function SkeletonCard({ className }: SkeletonCardProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="skeleton-card"
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 shadow-card",
        className,
      )}
    >
      <Skeleton width="55%" height={14} />
      <Skeleton width="80%" height={9} />
      <Skeleton width="65%" height={9} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SkeletonList                                                                */
/* -------------------------------------------------------------------------- */

export interface SkeletonListProps {
  rows: number;
  className?: string;
}

/**
 * Stacked row placeholders. `rows` controls how many shimmer lines are shown.
 * Purely decorative — aria-hidden.
 */
export function SkeletonList({ rows, className }: SkeletonListProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="skeleton-list"
      className={cn("flex flex-col gap-2", className)}
    >
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={32} className="woa-skel rounded-md" />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* SkeletonTable                                                               */
/* -------------------------------------------------------------------------- */

export interface SkeletonTableProps {
  rows: number;
  cols: number;
  className?: string;
}

/**
 * A grid of shimmer cells (`rows × cols`). Purely decorative — aria-hidden.
 */
export function SkeletonTable({ rows, cols, className }: SkeletonTableProps) {
  return (
    <div
      aria-hidden="true"
      data-testid="skeleton-table"
      className={cn("flex flex-col gap-1", className)}
    >
      {Array.from({ length: rows }, (_, ri) => (
        <div key={ri} className="flex gap-1">
          {Array.from({ length: cols }, (_, ci) => (
            <Skeleton
              key={ci}
              height={28}
              className="woa-skel flex-1 rounded-sm"
            />
          ))}
        </div>
      ))}
    </div>
  );
}
