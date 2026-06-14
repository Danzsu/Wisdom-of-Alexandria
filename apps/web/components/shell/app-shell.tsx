"use client";

import type { ReactNode } from "react";
import { useShellChrome } from "@/lib/use-shell-chrome";
import { DEMO_BOOK_ID } from "@/lib/routes";
import { TopBar } from "./top-bar";
import { IconRail } from "./icon-rail";
import { ChapterTree } from "./chapter-tree";
import { CodexSidebar } from "./codex-sidebar";
import { StatusBar } from "./status-bar";
import { Sparkfield } from "./sparkfield";
import { CommandPalette } from "./command-palette";
import { CommandPaletteHotkey } from "./command-palette-hotkey";

/**
 * Persistent application shell rendered once by the `(app)` layout. Lays out:
 *
 *   TopBar (52px)
 *   └ body row: one left sidebar (rail | chapter-tree | codex) + main + (Write) AI inspector slot
 *   └ StatusBar (32px) — Write route only
 *
 * Which chrome shows is derived purely from the pathname (see useShellChrome):
 * - rail by default inside a book; chapter-tree on Write; codex sidebar on Codex
 * - outside a book (the projects picker) the rail/sidebars are hidden
 * - the StatusBar + AI-inspector slot appear only on the Write route
 *
 * The route children render into the `<main>` area.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const chrome = useShellChrome();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-text">
      <TopBar inBook={chrome.inBook} isWrite={chrome.isWrite} />

      <div className="flex min-h-0 flex-1">
        {chrome.showRail ? (
          chrome.leftSidebar === "tree" ? (
            <ChapterTree />
          ) : chrome.leftSidebar === "codex" ? (
            <CodexSidebar />
          ) : (
            <IconRail bookId={DEMO_BOOK_ID} activeSegment={chrome.segment} />
          )
        ) : null}

        <main className="flex min-w-0 flex-1 flex-col">{children}</main>

        {chrome.isWrite ? (
          <aside
            aria-label="AI segéd"
            className="flex w-inspector flex-none flex-col border-l border-border bg-surface"
          >
            {/* Placeholder — the AI inspector is filled in M5. */}
            <div className="p-4 text-[13px] text-text-faint">
              Az AI segéd az M5-ben érkezik.
            </div>
          </aside>
        ) : null}
      </div>

      {chrome.isWrite ? <StatusBar /> : null}

      <Sparkfield />
      <CommandPalette />
      <CommandPaletteHotkey />
    </div>
  );
}
