"use client";

import { Search, Users, SlidersHorizontal } from "lucide-react";
import { BrandStar } from "@/components/kit/brand-star";
import { Icon } from "@/components/kit/icon";
import { ThemeToggle } from "@/components/kit/theme-toggle";
import { toast } from "@/components/kit/toast";
import { Tooltip } from "@/components/kit/tooltip";
import { useNavTo } from "@/lib/use-nav-to";
import { useUIStore } from "@/lib/stores/ui-store";
import { routes } from "@/lib/routes";
import { hu } from "@/lib/i18n/hu";
import { UserMenu } from "./user-menu";
import { ProjectSwitcher } from "./project-switcher";

/** Static model pill placeholder (the real value comes from ModelRouter later). */
const PLACEHOLDER_MODEL = "ollama/llama3.2";

export interface TopBarProps {
  /** Whether the current route is inside a book (shows switcher + share). */
  inBook: boolean;
  /** Whether the current route is the Write view (shows the scene breadcrumb). */
  isWrite: boolean;
  /** Active book id (from the route) — drives breadcrumb/settings navigation. */
  bookId: string | null;
}

/**
 * Persistent 52px top bar. Brand mark routes to the projects picker. Inside a
 * book it adds the "/" separator + project switcher; on the Write route it
 * centres the scene breadcrumb. The right cluster holds the static model pill,
 * a Share pill (in-book stub → toast), the search trigger (opens the command
 * palette), the theme toggle, a settings button and the user menu.
 */
export function TopBar({ inBook, isWrite, bookId }: TopBarProps) {
  const navTo = useNavTo();
  const openCommand = useUIStore((s) => s.openCommand);

  return (
    <header className="relative z-10 flex h-topbar flex-none items-center gap-3 border-b border-border bg-surface px-3.5">
      {/* Brand → projects */}
      <button
        type="button"
        aria-label={hu.topbar.projectsAria}
        onClick={() => navTo(routes.projects())}
        className="flex items-center gap-[9px] rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-muted"
      >
        <BrandStar size={19} />
        <span className="font-serif text-[17px] font-semibold tracking-[0.01em] text-text">
          {hu.brand}
        </span>
      </button>

      {inBook ? (
        <>
          <span aria-hidden="true" className="text-[14px] text-text-faint">
            /
          </span>
          <ProjectSwitcher title={hu.project.demoTitle} bookId={bookId} />
        </>
      ) : null}

      {/* Centered scene breadcrumb (Write only) */}
      <div className="flex flex-1 justify-center">
        {isWrite && bookId ? (
          <button
            type="button"
            onClick={() => navTo(routes.book(bookId, "terv"))}
            className="flex h-[30px] items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-text-muted transition-colors hover:bg-surface-muted"
          >
            {hu.topbar.breadcrumbChapter}
            <span className="text-text-faint">›</span>
            <span className="font-medium text-text">
              {hu.topbar.breadcrumbScene}
            </span>
          </button>
        ) : null}
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-1.5">
        <span className="flex h-5 items-center rounded-full bg-ai-muted px-2 text-[10px] font-semibold text-ai-text">
          {PLACEHOLDER_MODEL}
        </span>

        {inBook ? (
          <Tooltip content={hu.topbar.shareTitle}>
            <button
              type="button"
              aria-label={hu.topbar.shareAria}
              onClick={() => toast(hu.toast.comingSoon)}
              className="flex h-[30px] items-center gap-[7px] rounded-full border border-border pl-2 pr-1.5 transition-colors hover:border-border-strong hover:bg-surface-muted"
            >
              <span className="flex">
                <span className="flex h-[21px] w-[21px] items-center justify-center rounded-full border-[1.5px] border-surface bg-pov2-bg text-[9px] font-bold text-pov2-tx">
                  KL
                </span>
                <span className="-ml-[7px] flex h-[21px] w-[21px] items-center justify-center rounded-full border-[1.5px] border-surface bg-pov4-bg text-[9px] font-bold text-pov4-tx">
                  Bt
                </span>
                <span className="-ml-[7px] flex h-[21px] w-[21px] items-center justify-center rounded-full border-[1.5px] border-surface bg-surface-muted text-[9px] font-bold text-text-muted">
                  +1
                </span>
              </span>
              <Icon icon={Users} size={13} className="text-text-muted" />
            </button>
          </Tooltip>
        ) : null}

        <button
          type="button"
          aria-label={hu.topbar.searchAria}
          onClick={openCommand}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
        >
          <Icon icon={Search} size={16} />
        </button>

        <ThemeToggle />

        <button
          type="button"
          aria-label={hu.topbar.settingsAria}
          disabled={!bookId}
          onClick={() => bookId && navTo(routes.book(bookId, "beallitasok"))}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Icon icon={SlidersHorizontal} size={16} />
        </button>

        <UserMenu />
      </div>
    </header>
  );
}
