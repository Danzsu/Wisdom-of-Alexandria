"use client";

import {
  BookOpen,
  PenLine,
  Database,
  MessageSquare,
  Sparkle,
  Download,
  Settings,
  Wrench,
  Eye,
  CalendarDays,
  Network,
  GitBranch,
  ListChecks,
  Sparkles,
  AudioLines,
  ScrollText,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/kit/icon";
import { Tooltip } from "@/components/kit/tooltip";
import {
  PopoverMenu,
  PopoverMenuTrigger,
  PopoverMenuContent,
  MenuRow,
  MenuSection,
  MenuSeparator,
} from "@/components/kit/popover-menu";
import { useNavTo } from "@/lib/use-nav-to";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useBookTree } from "@/lib/api/hooks";
import { useFailedJobCount } from "@/lib/api/ai-hooks";
import { routes, type BookSegment } from "@/lib/routes";
import { hu } from "@/lib/i18n/hu";

interface RailItem {
  /** Stable key + the segment whose active route highlights this item. */
  key: string;
  /** Route segment that drives the active highlight (null = no segment match). */
  segment: BookSegment | null;
  label: string;
  icon: LucideIcon;
  /** Destination override (Write resolves a real scene at click time). */
  href: (bookId: string) => string;
}

/**
 * Primary workspace destinations, in rail order, matching the prototype primary
 * rail (proto ~222-265): Terv, Írás, Codex, Chat, Tiszta írás, [spacer], Tools,
 * Export, Beállítások. The V1 screens (Áttekintés / Idősor / Kapcsolatok /
 * Cselekményszálak) live in the Tools flyout, not the primary rail.
 */
const RAIL_ITEMS: RailItem[] = [
  {
    key: "terv",
    segment: "terv",
    label: hu.nav.terv,
    icon: BookOpen,
    href: (b) => routes.book(b, "terv"),
  },
  {
    key: "iras",
    segment: "iras",
    label: hu.nav.iras,
    icon: PenLine,
    // The Write destination is resolved at render time from the loaded book
    // tree (first real scene, else the Plan view) — see `irasHref` below; this
    // fallback only fires if the tree never loaded.
    href: (b) => routes.book(b, "terv"),
  },
  {
    key: "codex",
    segment: "codex",
    label: hu.nav.codex,
    icon: Database,
    href: (b) => routes.book(b, "codex"),
  },
  {
    key: "chat",
    segment: "chat",
    label: hu.nav.chat,
    icon: MessageSquare,
    href: (b) => routes.book(b, "chat"),
  },
];

/** Segments surfaced inside the Tools flyout (drive the Tools active dot). */
const TOOLS_SEGMENTS: BookSegment[] = [
  "attekintes",
  "idosor",
  "kapcsolatok",
  "cselekmenyszalak",
  "feladatok",
  "promptok",
  "stiluskalauz",
  "hangok",
];

export interface IconRailProps {
  /** Active book id (used to build destinations). */
  bookId: string;
  /** Active book segment (drives the active highlight). */
  activeSegment: BookSegment | null;
}

/**
 * 56px vertical workspace rail. Each item navigates (+sparkfield) and exposes
 * its Hungarian label as a tooltip and aria-label. The active item — derived
 * from the route segment — gets the accent-muted highlight + a `woaRailPop`
 * pop on its icon. The "Tiszta írás" item routes to the manuscript and enables
 * the AI-free writing mode. A Tools flyout (warning dot + "AI feladatok" badge)
 * holds the V1 analysis screens + the prompt/voice libraries.
 */
export function IconRail({ bookId, activeSegment }: IconRailProps) {
  const navTo = useNavTo();
  const openMenu = useUIStore((s) => s.openMenu);
  const setMenu = useUIStore((s) => s.setMenu);
  const setAiFree = useEditorStore((s) => s.setAiFree);
  const toolsOpen = openMenu === "tools";
  const toolsActive =
    activeSegment != null && TOOLS_SEGMENTS.includes(activeSegment);

  // Resolve the Write destination to the book's FIRST real scene; if the book
  // has no scene yet (or the tree hasn't loaded) fall back to the Plan view,
  // where scene creation will live (M7) — never a fabricated demo scene id.
  const tree = useBookTree(bookId || undefined);
  const firstSceneId = tree.chapters[0]?.scenes[0]?.id;
  const irasHref = firstSceneId
    ? routes.scene(bookId, firstSceneId)
    : routes.book(bookId, "terv");

  // Live attention count: the number of FAILED AI jobs for this book (B1). Drives
  // the Tools warning dot + the "AI feladatok" badge. Both are hidden when 0, so
  // the rail signals attention HONESTLY (no permanent dot / fabricated count).
  const failedJobCount = useFailedJobCount(bookId || undefined);
  const hasFailedJobs = failedJobCount > 0;

  /** Tiszta írás: open the manuscript in AI-free mode (prototype gocleanwrite). */
  function goCleanWrite() {
    setAiFree(true);
    navTo(irasHref);
  }

  return (
    <nav
      aria-label={hu.shell.railAria}
      className="flex w-rail flex-none flex-col items-center gap-1 overflow-y-auto border-r border-border bg-bg-subtle py-3"
    >
      {RAIL_ITEMS.map((item) => {
        const active = item.segment === activeSegment;
        const href = item.segment === "iras" ? irasHref : item.href(bookId);
        return (
          <Tooltip key={item.key} content={item.label} side="right">
            <button
              type="button"
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={() => navTo(href)}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-[11px] transition-colors",
                active
                  ? "bg-accent-muted text-accent-text"
                  : "text-text-muted hover:bg-surface-muted hover:text-text",
              )}
            >
              <Icon
                icon={item.icon}
                size={18}
                className={active ? "[animation:woaRailPop_.3s_ease-out]" : undefined}
              />
            </button>
          </Tooltip>
        );
      })}

      {/* Tiszta írás — toggles AI-free writing mode then opens the manuscript. */}
      <Tooltip content={hu.nav.cleanWrite} side="right">
        <button
          type="button"
          aria-label={hu.nav.cleanWrite}
          onClick={goCleanWrite}
          className="flex h-10 w-10 items-center justify-center rounded-[11px] text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
        >
          <Icon icon={Sparkle} size={18} />
        </button>
      </Tooltip>

      <div className="flex-1" />

      {/* Tools flyout */}
      <PopoverMenu
        open={toolsOpen}
        onOpenChange={(open) => setMenu(open ? "tools" : null)}
      >
        <Tooltip content={hu.nav.tools} side="right">
          <PopoverMenuTrigger asChild>
            <button
              type="button"
              aria-label={hu.nav.tools}
              aria-current={toolsActive ? "page" : undefined}
              className={cn(
                "relative flex h-10 w-10 items-center justify-center rounded-[11px] transition-colors",
                toolsOpen || toolsActive
                  ? "bg-accent-muted text-accent-text"
                  : "text-text-muted hover:bg-surface-muted hover:text-text",
              )}
            >
              <Icon icon={Wrench} size={18} />
              {/* Attention dot — shown ONLY when there are failed AI jobs (B1).
                  No failures → no dot, so the rail never cries wolf. */}
              {hasFailedJobs ? (
                <span
                  aria-hidden="true"
                  className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full border-[1.5px] border-bg-subtle bg-warning"
                />
              ) : null}
            </button>
          </PopoverMenuTrigger>
        </Tooltip>
        <PopoverMenuContent side="right" align="end" className="min-w-[220px]">
          <MenuSection label={hu.tools.sectionAnalysis} />
          <MenuRow
            leadingIcon={<Icon icon={Eye} size={15} />}
            onSelect={() => navTo(routes.book(bookId, "attekintes"))}
          >
            {hu.tools.review}
          </MenuRow>
          <MenuRow
            leadingIcon={<Icon icon={CalendarDays} size={15} />}
            onSelect={() => navTo(routes.book(bookId, "idosor"))}
          >
            {hu.tools.timeline}
          </MenuRow>
          <MenuRow
            leadingIcon={<Icon icon={Network} size={15} />}
            onSelect={() => navTo(routes.book(bookId, "kapcsolatok"))}
          >
            {hu.tools.relations}
          </MenuRow>
          <MenuRow
            leadingIcon={<Icon icon={GitBranch} size={15} />}
            onSelect={() => navTo(routes.book(bookId, "cselekmenyszalak"))}
          >
            {hu.tools.subplots}
          </MenuRow>
          <MenuRow
            leadingIcon={<Icon icon={ListChecks} size={15} />}
            trailing={
              // Failed-job count badge — real count from useJobs (B1). Hidden
              // entirely at 0 (no badge when nothing needs attention). The
              // count is also announced for screen readers via aria-label.
              hasFailedJobs ? (
                <span
                  aria-label={hu.tools.jobsBadgeAria(failedJobCount)}
                  className="flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[9px] font-bold text-white"
                >
                  {failedJobCount}
                </span>
              ) : undefined
            }
            onSelect={() => navTo(routes.book(bookId, "feladatok"))}
          >
            {hu.tools.jobs}
          </MenuRow>
          <MenuSeparator />
          <MenuSection label={hu.tools.sectionStores} />
          <MenuRow
            leadingIcon={<Icon icon={ScrollText} size={15} />}
            onSelect={() => navTo(routes.styleGuide(bookId))}
          >
            {hu.tools.styleGuide}
          </MenuRow>
          <MenuRow
            leadingIcon={<Icon icon={Sparkles} size={15} />}
            onSelect={() => navTo(routes.book(bookId, "promptok"))}
          >
            {hu.tools.prompts}
          </MenuRow>
          <MenuRow
            leadingIcon={<Icon icon={AudioLines} size={15} />}
            onSelect={() => navTo(routes.book(bookId, "hangok"))}
          >
            {hu.tools.audio}
          </MenuRow>
        </PopoverMenuContent>
      </PopoverMenu>

      <Tooltip content={hu.nav.export} side="right">
        <button
          type="button"
          aria-label={hu.nav.export}
          aria-current={activeSegment === "export" ? "page" : undefined}
          onClick={() => navTo(routes.book(bookId, "export"))}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-[11px] transition-colors",
            activeSegment === "export"
              ? "bg-accent-muted text-accent-text"
              : "text-text-muted hover:bg-surface-muted hover:text-text",
          )}
        >
          <Icon icon={Download} size={18} />
        </button>
      </Tooltip>

      <Tooltip content={hu.nav.settings} side="right">
        <button
          type="button"
          aria-label={hu.nav.settings}
          aria-current={activeSegment === "beallitasok" ? "page" : undefined}
          onClick={() => navTo(routes.book(bookId, "beallitasok"))}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-[11px] transition-colors",
            activeSegment === "beallitasok"
              ? "bg-accent-muted text-accent-text"
              : "text-text-muted hover:bg-surface-muted hover:text-text",
          )}
        >
          <Icon icon={Settings} size={18} />
        </button>
      </Tooltip>
    </nav>
  );
}
