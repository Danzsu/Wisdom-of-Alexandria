"use client";

import { CircleHelp, Search, Users, SlidersHorizontal, PanelLeft, PanelRight } from "lucide-react";
import { BrandStar } from "@/components/kit/brand-star";
import { Icon } from "@/components/kit/icon";
import { ThemeToggle } from "@/components/kit/theme-toggle";
import { toast } from "@/components/kit/toast";
import { Tooltip } from "@/components/kit/tooltip";
import { useNavTo } from "@/lib/use-nav-to";
import { useUIStore } from "@/lib/stores/ui-store";
import { useInspectorModels } from "@/components/inspector/use-inspector-models";
import { routes } from "@/lib/routes";
import { hu } from "@/lib/i18n/hu";
import { UserMenu } from "./user-menu";
import { ProjectSwitcher } from "./project-switcher";
import { AiJobIndicator } from "./ai-job-indicator";

export interface TopBarProps {
  /** Whether the current route is inside a book (shows switcher + share). */
  inBook: boolean;
  /** Whether the current route is the Write view (shows the scene breadcrumb). */
  isWrite: boolean;
  /** Active book id (from the route) — drives breadcrumb/settings navigation. */
  bookId: string | null;
  /**
   * Whether the responsive left-pane (chapter tree / codex) drawer toggle is
   * available for this route. The button is itself CSS-hidden at/above `lg`
   * (the pane is inline there); this only gates whether the route HAS a pane.
   */
  showTreeToggle?: boolean;
  /** Whether the responsive AI-inspector drawer toggle is available (Write). */
  showInspectorToggle?: boolean;
}

/**
 * Persistent 52px top bar. Brand mark routes to the projects picker. Inside a
 * book it adds the "/" separator + project switcher; on the Write route it
 * centres the scene breadcrumb. The right cluster holds the config-driven model
 * pill, a Share pill (in-book stub → toast), the search trigger (opens the
 * command palette), the theme toggle, a settings button and the user menu.
 */
export function TopBar({
  inBook,
  isWrite,
  bookId,
  showTreeToggle = false,
  showInspectorToggle = false,
}: Readonly<TopBarProps>) {
  const navTo = useNavTo();
  const openCommand = useUIStore((s) => s.openCommand);
  const openHowItWorks = useUIStore((s) => s.openHowItWorks);
  const shellDrawer = useUIStore((s) => s.shellDrawer);
  const toggleShellDrawer = useUIStore((s) => s.toggleShellDrawer);
  // The active model is config-driven (same /ai/models source the StatusBar +
  // inspector use); never a hardcoded model name.
  const models = useInspectorModels();
  const activeModel = models.value || hu.inspector.metaUnknown;

  return (
    <header className="relative z-10 flex h-topbar flex-none items-center gap-3 border-b border-border bg-surface px-3.5">
      {/* Responsive left-pane (chapter tree / codex) drawer toggle. Hidden at
          and above `lg` (the pane is inline there); only the small-screen layout
          surfaces it. aria-expanded/aria-controls describe the drawer it opens. */}
      {showTreeToggle ? (
        <button
          type="button"
          aria-label={hu.shell.openTreeDrawerAria}
          aria-expanded={shellDrawer === "tree"}
          aria-controls="shell-drawer-tree"
          onClick={() => toggleShellDrawer("tree")}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text lg:hidden"
        >
          <Icon icon={PanelLeft} size={16} />
        </button>
      ) : null}

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
        {/* Persistent, calm AI-job indicator (running pulse / failed count /
            hidden when idle). Scoped to the active book. */}
        <AiJobIndicator bookId={bookId} />

        <span className="flex h-5 items-center rounded-full bg-ai-muted px-2 text-[10px] font-semibold text-ai-text">
          {activeModel}
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

        {/* On-demand "Hogyan működik?" help — opens the scroll-narrative modal.
            Always visible; demotes the old first-run auto-open to a pull trigger
            so the inline onboarding banner is the sole first-run affordance. */}
        <Tooltip content={hu.topbar.helpAria}>
          <button
            type="button"
            aria-label={hu.topbar.helpAria}
            onClick={openHowItWorks}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
          >
            <Icon icon={CircleHelp} size={16} />
          </button>
        </Tooltip>

        <ThemeToggle />

        {/* Responsive AI-inspector drawer toggle (Write route). Hidden ≥ lg
            where the inspector is inline. */}
        {showInspectorToggle ? (
          <button
            type="button"
            aria-label={hu.shell.openInspectorDrawerAria}
            aria-expanded={shellDrawer === "inspector"}
            aria-controls="shell-drawer-inspector"
            onClick={() => toggleShellDrawer("inspector")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text lg:hidden"
          >
            <Icon icon={PanelRight} size={16} />
          </button>
        ) : null}

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
