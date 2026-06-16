"use client";

import { useEffect, type ReactNode } from "react";
import { useShellChrome } from "@/lib/use-shell-chrome";
import { useEditorStore } from "@/lib/stores/editor-store";
import { hu } from "@/lib/i18n/hu";
import { TopBar } from "./top-bar";
import { IconRail } from "./icon-rail";
import { ChapterTree } from "./chapter-tree";
import { CodexSidebar } from "./codex-sidebar";
import { StatusBar } from "./status-bar";
import { Sparkfield } from "./sparkfield";
import { CommandPalette } from "./command-palette";
import { CommandPaletteHotkey } from "./command-palette-hotkey";
import { ShortcutsOverlay } from "./shortcuts-overlay";
import { ShortcutsOverlayHotkey } from "./shortcuts-overlay-hotkey";
import {
  HowItWorks,
  HowItWorksFirstRun,
} from "@/components/onboarding/how-it-works";
import { InspectorPanel } from "@/components/inspector/inspector-panel";
import { AiGenerationProvider } from "@/components/inspector/ai-generation-context";

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
 * Focus mode (`focusOn`, Write route only): distraction-free writing. The TopBar,
 * left sidebar (chapter tree), AI-inspector slot and StatusBar are all hidden,
 * leaving only the manuscript `<main>` (its in-page toolbar — with the Fókusz
 * toggle — and the timeline rail are gated by the page). Esc exits focus mode so
 * the chrome is always recoverable without a mouse.
 *
 * The route children render into the `<main>` area.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const chrome = useShellChrome();
  const focusOn = useEditorStore((s) => s.focusOn);
  const toggleFocus = useEditorStore((s) => s.toggleFocus);
  // Focus mode only applies on the Write route (it's the only route with the
  // toggle / a manuscript to focus on).
  const focusMode = chrome.isWrite && focusOn;

  // Esc exits focus mode (keeps the chrome recoverable without the toggle).
  useEffect(() => {
    if (!focusMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") toggleFocus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [focusMode, toggleFocus]);

  const body = (
    <div className="flex min-h-0 flex-1">
      {chrome.showRail && !focusMode ? (
        chrome.leftSidebar === "tree" ? (
          <ChapterTree />
        ) : chrome.leftSidebar === "codex" ? (
          <CodexSidebar />
        ) : (
          // The rail only renders inside a book, so bookId is always present
          // here; the `?? ""` keeps the prop type strict without a non-null !.
          <IconRail bookId={chrome.bookId ?? ""} activeSegment={chrome.segment} />
        )
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>

      {chrome.isWrite && !focusMode ? (
        <aside
          aria-label={hu.shell.aiInspectorAria}
          className="flex w-inspector flex-none flex-col border-l border-border bg-surface"
        >
          <InspectorPanel />
        </aside>
      ) : null}
    </div>
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-text">
      {focusMode ? null : (
        <TopBar
          inBook={chrome.inBook}
          isWrite={chrome.isWrite}
          bookId={chrome.bookId}
        />
      )}

      {/* The AI generation provider spans the manuscript `<main>` and the
          inspector `<aside>` on the Write route so the editor seams and the AI
          tab share one generation → accept → insert flow. Off the Write route
          there is no editor, so the provider is unnecessary. */}
      {chrome.isWrite ? (
        <AiGenerationProvider>{body}</AiGenerationProvider>
      ) : (
        body
      )}

      {chrome.isWrite && !focusMode ? <StatusBar /> : null}

      <Sparkfield />
      <CommandPalette />
      <CommandPaletteHotkey />
      <ShortcutsOverlay />
      <ShortcutsOverlayHotkey />
      <HowItWorks />
      <HowItWorksFirstRun />
    </div>
  );
}
