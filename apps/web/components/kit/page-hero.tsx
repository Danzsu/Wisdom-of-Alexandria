import { cn } from "@/lib/utils";

export interface PageHeroProps {
  /** Small uppercase eyebrow label above the title (with a leading gold rule). */
  eyebrow: string;
  /** The display-font screen title. */
  title: string;
  /** Optional italic manuscript-serif subtitle below the title. */
  subtitle?: string;
  /** Optional trailing slot rendered on the right of the title row. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Screen hero header for the full-bleed scrolling screens (Export, Settings,
 * …): a short gold rule + uppercase eyebrow, a large `font-display` title, and
 * an optional italic manuscript subtitle. Mirrors the prototype's per-screen
 * header treatment (Alexandria.dc.html — EXPORT / SETTINGS sections).
 */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: PageHeroProps) {
  return (
    <div className={cn("mb-6", className)}>
      <span className="mb-3 flex items-center gap-3">
        <span aria-hidden="true" className="h-px w-[26px] bg-gold-line" />
        <span className="text-[11px] font-semibold uppercase tracking-[.16em] text-gold-text">
          {eyebrow}
        </span>
      </span>
      <div className="flex items-end justify-between gap-4">
        <h1 className="m-0 font-display text-[clamp(32px,5vw,40px)] font-semibold leading-[1.04] text-text">
          {title}
        </h1>
        {action ? <div className="flex-none pb-1">{action}</div> : null}
      </div>
      {subtitle ? (
        <p className="mt-2 font-serif text-[15px] italic text-text-muted">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
