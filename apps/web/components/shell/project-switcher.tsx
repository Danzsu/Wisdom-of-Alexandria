"use client";

import { ChevronDown, BookOpen } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import {
  PopoverMenu,
  PopoverMenuTrigger,
  PopoverMenuContent,
  MenuRow,
} from "@/components/kit/popover-menu";
import { useNavTo } from "@/lib/use-nav-to";
import { useUIStore } from "@/lib/stores/ui-store";
import { routes } from "@/lib/routes";
import { hu } from "@/lib/i18n/hu";

/** Placeholder project list (real data arrives in M3). */
const PLACEHOLDER_PROJECTS = [{ id: "demo", title: hu.project.demoTitle }];

/**
 * TopBar project switcher (shown only inside a book). Renders the current book
 * title + chevron and opens a placeholder project list; choosing one routes to
 * the projects picker for now (real switching lands with M3 data). Open state
 * is owned by the shared UI store (single-open menu rule).
 */
export function ProjectSwitcher({ title }: { title: string }) {
  const navTo = useNavTo();
  const openMenu = useUIStore((s) => s.openMenu);
  const setMenu = useUIStore((s) => s.setMenu);
  const open = openMenu === "project";

  return (
    <PopoverMenu open={open} onOpenChange={(o) => setMenu(o ? "project" : null)}>
      <PopoverMenuTrigger asChild>
        <button
          type="button"
          aria-label={title}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[14px] text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
        >
          {title}
          <Icon icon={ChevronDown} size={13} />
        </button>
      </PopoverMenuTrigger>
      <PopoverMenuContent align="start" className="min-w-[220px]">
        {PLACEHOLDER_PROJECTS.map((p) => (
          <MenuRow
            key={p.id}
            leadingIcon={<Icon icon={BookOpen} size={15} />}
            onSelect={() => navTo(routes.projects())}
          >
            {p.title}
          </MenuRow>
        ))}
      </PopoverMenuContent>
    </PopoverMenu>
  );
}
