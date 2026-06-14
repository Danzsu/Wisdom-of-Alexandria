"use client";

import { Rows2, Rows3, Rows4, Search } from "lucide-react";
import { SegmentedControl } from "@/components/kit";
import { Icon } from "@/components/kit/icon";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import { routes } from "@/lib/routes";
import { useNavTo } from "@/lib/use-nav-to";
import type { PlanDensity, PlanView } from "./types";

export interface PlanHeaderProps {
  bookId: string | undefined;
  view: PlanView;
  onViewChange: (view: PlanView) => void;
  density: PlanDensity;
  onDensityChange: (density: PlanDensity) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

/**
 * Plan Board header: the mode pills (Terv active · Írás · Chat → routes), the
 * view toggle (Rács / Mátrix / Vázlat via SegmentedControl), the density toggle
 * (icon SegmentedControl) and a search field. Mode pills navigate to the book's
 * other screens; the active "Terv" pill is the accent-filled one.
 */
export function PlanHeader({
  bookId,
  view,
  onViewChange,
  density,
  onDensityChange,
  search,
  onSearchChange,
}: PlanHeaderProps) {
  const navTo = useNavTo();

  return (
    <div className="flex h-12 flex-none items-center gap-2 border-b border-border bg-surface px-5">
      {/* Mode pills */}
      <span className="flex h-[30px] items-center rounded-full bg-accent-strong px-3.5 text-[13px] font-semibold text-accent-fg">
        {hu.plan.modeTerv}
      </span>
      <button
        type="button"
        onClick={() => bookId && navTo(routes.book(bookId, "iras"))}
        className="flex h-[30px] items-center rounded-full bg-transparent px-3.5 text-[13px] text-text-muted hover:bg-surface-muted hover:text-text"
      >
        {hu.plan.modeIras}
      </button>
      <button
        type="button"
        onClick={() => bookId && navTo(routes.book(bookId, "chat"))}
        className="flex h-[30px] items-center rounded-full bg-transparent px-3.5 text-[13px] text-text-muted hover:bg-surface-muted hover:text-text"
      >
        {hu.plan.modeChat}
      </button>

      <span
        className="mx-1.5 h-5 w-px bg-border"
        aria-hidden="true"
      />

      {/* View toggle */}
      <SegmentedControl<PlanView>
        aria-label={hu.plan.viewToggleAria}
        value={view}
        onValueChange={onViewChange}
        options={[
          { value: "grid", label: hu.plan.viewGrid },
          { value: "matrix", label: hu.plan.viewMatrix },
          { value: "outline", label: hu.plan.viewOutline },
        ]}
      />

      <div className="flex-1" />

      {/* Density toggle (icon segments) */}
      <SegmentedControl<PlanDensity>
        aria-label={hu.plan.densityAria}
        variant="icon"
        value={density}
        onValueChange={onDensityChange}
        options={[
          {
            value: "default",
            label: hu.plan.densityDefault,
            icon: <Icon icon={Rows2} size={13} />,
          },
          {
            value: "compact",
            label: hu.plan.densityCompact,
            icon: <Icon icon={Rows3} size={13} />,
          },
          {
            value: "slim",
            label: hu.plan.densitySlim,
            icon: <Icon icon={Rows4} size={13} />,
          },
        ]}
      />

      {/* Search */}
      <label
        className={cn(
          "flex h-8 w-[200px] items-center gap-[7px] rounded-lg border border-border bg-surface px-2.5",
          "focus-within:border-accent",
        )}
      >
        <Icon icon={Search} size={14} className="text-text-faint" />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={hu.plan.searchPlaceholder}
          aria-label={hu.plan.searchAria}
          className="min-w-0 flex-1 border-none bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint"
        />
      </label>
    </div>
  );
}
