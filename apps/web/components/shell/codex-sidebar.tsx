"use client";

import { BrandStar } from "@/components/kit/brand-star";
import { hu } from "@/lib/i18n/hu";

/**
 * 300px Codex list sidebar — Codex route only. M2 ships a labelled placeholder
 * with the book header so the shell layout is verifiable; the real Codex list
 * (tabs, search, grouped entries, scope toggle) is filled in M6.
 */
export function CodexSidebar() {
  return (
    <nav
      aria-label={hu.shell.codexSidebarAria}
      className="flex w-codex-sidebar flex-none flex-col border-r border-border bg-bg-subtle"
    >
      <div className="flex items-center gap-[11px] border-b border-border p-3.5">
        <div className="flex h-14 w-10 flex-none items-end justify-center rounded-md border border-accent bg-[linear-gradient(150deg,var(--accent)_0%,#b8893f_55%,#8a6a2e_100%)] pb-[5px] text-accent-fg">
          <BrandStar size={14} className="fill-current" />
        </div>
        <div className="min-w-0">
          <p className="m-0 truncate text-[14px] font-semibold text-text">
            {hu.project.demoTitle}
          </p>
          <p className="m-0 mt-0.5 text-[12px] text-text-muted">
            {hu.project.author}
          </p>
        </div>
      </div>
      <div className="flex-1 p-3.5 text-[13px] text-text-muted">
        {/* Placeholder — Codex list arrives in M6. */}
        <p className="m-0">{hu.shell.codexComingSoon}</p>
      </div>
    </nav>
  );
}
