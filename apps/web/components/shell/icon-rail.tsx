"use client";

import {
  LayoutDashboard,
  BookOpen,
  PenLine,
  Database,
  CalendarDays,
  Network,
  GitBranch,
  MessageSquare,
  Download,
  Wrench,
  Eye,
  ListChecks,
  Sparkles,
  AudioLines,
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
import { routes, DEMO_SCENE_ID, type BookSegment } from "@/lib/routes";
import { hu } from "@/lib/i18n/hu";

interface RailItem {
  segment: BookSegment;
  label: string;
  icon: LucideIcon;
  /** Destination override (Write needs a scene id). */
  href: (bookId: string) => string;
}

/** Primary workspace destinations, in rail order. */
const RAIL_ITEMS: RailItem[] = [
  {
    segment: "attekintes",
    label: hu.nav.attekintes,
    icon: LayoutDashboard,
    href: (b) => routes.book(b, "attekintes"),
  },
  {
    segment: "terv",
    label: hu.nav.terv,
    icon: BookOpen,
    href: (b) => routes.book(b, "terv"),
  },
  {
    segment: "iras",
    label: hu.nav.iras,
    icon: PenLine,
    href: (b) => routes.scene(b, DEMO_SCENE_ID),
  },
  {
    segment: "codex",
    label: hu.nav.codex,
    icon: Database,
    href: (b) => routes.book(b, "codex"),
  },
  {
    segment: "idosor",
    label: hu.nav.idosor,
    icon: CalendarDays,
    href: (b) => routes.book(b, "idosor"),
  },
  {
    segment: "kapcsolatok",
    label: hu.nav.kapcsolatok,
    icon: Network,
    href: (b) => routes.book(b, "kapcsolatok"),
  },
  {
    segment: "cselekmenyszalak",
    label: hu.nav.cselekmenyszalak,
    icon: GitBranch,
    href: (b) => routes.book(b, "cselekmenyszalak"),
  },
  {
    segment: "chat",
    label: hu.nav.chat,
    icon: MessageSquare,
    href: (b) => routes.book(b, "chat"),
  },
  {
    segment: "export",
    label: hu.nav.export,
    icon: Download,
    href: (b) => routes.book(b, "export"),
  },
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
 * pop on its icon. A Tools flyout (warning dot + "AI feladatok" badge) opens a
 * PopoverMenu of secondary destinations.
 */
export function IconRail({ bookId, activeSegment }: IconRailProps) {
  const navTo = useNavTo();
  const openMenu = useUIStore((s) => s.openMenu);
  const setMenu = useUIStore((s) => s.setMenu);
  const toolsOpen = openMenu === "tools";

  return (
    <nav
      aria-label="Munkaterület"
      className="flex w-rail flex-none flex-col items-center gap-1 border-r border-border bg-bg-subtle py-2.5"
    >
      {RAIL_ITEMS.map((item) => {
        const active = item.segment === activeSegment;
        return (
          <Tooltip key={item.segment} content={item.label} side="right">
            <button
              type="button"
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={() => navTo(item.href(bookId))}
              className={cn(
                "flex h-[38px] w-[38px] items-center justify-center rounded-[10px] transition-colors",
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
              className={cn(
                "relative flex h-[38px] w-[38px] items-center justify-center rounded-[10px] transition-colors",
                toolsOpen
                  ? "bg-accent-muted text-accent-text"
                  : "text-text-muted hover:bg-surface-muted hover:text-text",
              )}
            >
              <Icon icon={Wrench} size={18} />
              {/* Unread/attention dot. */}
              <span
                aria-hidden="true"
                className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full border-[1.5px] border-bg-subtle bg-warning"
              />
            </button>
          </PopoverMenuTrigger>
        </Tooltip>
        <PopoverMenuContent side="right" align="end" className="min-w-[220px]">
          <MenuSection label={hu.tools.sectionAnalysis} />
          <MenuRow
            leadingIcon={<Icon icon={ListChecks} size={15} />}
            trailing={
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-ai px-1 text-[9px] font-bold text-white">
                2
              </span>
            }
            onSelect={() => navTo(routes.book(bookId, "feladatok"))}
          >
            {hu.tools.jobs}
          </MenuRow>
          <MenuRow
            leadingIcon={<Icon icon={Eye} size={15} />}
            onSelect={() => navTo(routes.book(bookId, "attekintes"))}
          >
            {hu.tools.review}
          </MenuRow>
          <MenuSeparator />
          <MenuSection label={hu.tools.sectionStores} />
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
    </nav>
  );
}
