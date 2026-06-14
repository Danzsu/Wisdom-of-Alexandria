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

/** Placeholder project list.
 *
 * Note: wiring this to `useProjects()` was deferred. The shell's TopBar tests
 * mount the switcher without a QueryClientProvider, so introducing a Query hook
 * here would require touching unrelated shell tests. Real project switching
 * lands when the switcher is wired to `useProjects()` (a later milestone), when
 * the shell test harness can provide the Query/MSW context. The list is a
 * sample/demo placeholder for now. */
const PLACEHOLDER_PROJECTS = [{ id: "demo", title: hu.project.demoTitle }];

/**
 * TopBar project switcher (shown only inside a book). Renders the current book
 * title + chevron and opens a placeholder project list. The current book entry
 * routes to its plan view (real book id, never a demo id); other entries fall
 * back to the projects picker until the switcher is wired to `useProjects()`.
 * Open state is owned by the shared UI store (single-open menu rule).
 */
export function ProjectSwitcher({
  title,
  bookId,
}: {
  title: string;
  bookId: string | null;
}) {
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
            // The current book routes to its plan view with the REAL book id;
            // every other (placeholder) entry falls back to the projects picker
            // until real project switching is wired in.
            onSelect={() =>
              navTo(bookId ? routes.book(bookId, "terv") : routes.projects())
            }
          >
            {p.title}
          </MenuRow>
        ))}
      </PopoverMenuContent>
    </PopoverMenu>
  );
}
