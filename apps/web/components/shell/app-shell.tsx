"use client";

import { useEffect, type ReactNode } from "react";
import { useShellChrome, type ShellChrome } from "@/lib/use-shell-chrome";
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
import { ShellDrawer } from "./shell-drawer";
import { useUIStore } from "@/lib/stores/ui-store";

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
/**
 * Resolve the left structure pane (tree on Write, codex on Codex) plus the
 * drawer metadata it needs below `lg`. The rail is intentionally NOT a drawer —
 * it stays inline (it is already compact at 56px). Returns null when the left
 * side hosts the rail (or nothing).
 */
function leftPaneFor(sidebar: ShellChrome["leftSidebar"]): {
  node: ReactNode;
  label: string;
  widthClass: string;
} | null {
  if (sidebar === "tree") {
    return {
      node: <ChapterTree />,
      label: hu.write.chapterTreeAria,
      widthClass: "w-tree",
    };
  }
  if (sidebar === "codex") {
    return {
      node: <CodexSidebar />,
      label: hu.shell.codexSidebarAria,
      widthClass: "w-codex-sidebar",
    };
  }
  return null;
}

export function AppShell({ children }: { readonly children: ReactNode }) {
  const chrome = useShellChrome();
  const focusOn = useEditorStore((s) => s.focusOn);
  const toggleFocus = useEditorStore((s) => s.toggleFocus);
  const closeShellDrawer = useUIStore((s) => s.closeShellDrawer);
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

  // The responsive drawers only make sense while their pane is part of the
  // route's chrome. Entering focus mode (which hides ALL chrome) closes any open
  // drawer so a stray overlay can't survive into distraction-free writing.
  useEffect(() => {
    if (focusMode) closeShellDrawer();
  }, [focusMode, closeShellDrawer]);

  const leftPane = leftPaneFor(chrome.leftSidebar);
  // The left structure pane collapses into a drawer below `lg`; the rail does
  // not. The inspector drawer only exists on the Write route.
  const hasLeftDrawer = chrome.showRail && !focusMode && leftPane !== null;
  const hasInspectorDrawer = chrome.isWrite && !focusMode;
  const showLeftSide = chrome.showRail && !focusMode;

  // The left side: the inline structure pane (desktop; `max-lg:hidden` so the
  // drawer takes over below `lg`), or the always-inline rail. Resolved here so
  // the body JSX below stays a flat list rather than nested conditionals.
  let leftSide: ReactNode = null;
  if (showLeftSide && leftPane) {
    // `max-lg:hidden` keeps the desktop layout as the unprefixed BASE, so jsdom
    // (no min-width matchMedia) still renders it inline — existing tests green.
    leftSide = <div className="flex max-lg:hidden">{leftPane.node}</div>;
  } else if (showLeftSide) {
    // The rail only renders inside a book, so bookId is always present here; the
    // `?? ""` keeps the prop type strict without a non-null assertion.
    leftSide = (
      <IconRail bookId={chrome.bookId ?? ""} activeSegment={chrome.segment} />
    );
  }

  const body = (
    <div className="flex min-h-0 flex-1">
      {leftSide}

      <main className="flex min-w-0 flex-1 flex-col">{children}</main>

      {hasInspectorDrawer ? (
        <aside
          aria-label={hu.shell.aiInspectorAria}
          className="flex w-inspector flex-none flex-col border-l border-border bg-surface max-lg:hidden"
        >
          <InspectorPanel />
        </aside>
      ) : null}

      {/* Below `lg` the same panes live in slide-in drawers (Radix Dialog:
          focus-trapped, Esc/scrim-closable, labelled). They are closed on
          desktop (their toggles are CSS-hidden ≥ lg), so the inline panes above
          are what desktop / jsdom render. */}
      {hasLeftDrawer && leftPane ? (
        <ShellDrawer
          id="tree"
          side="left"
          label={leftPane.label}
          widthClass={leftPane.widthClass}
        >
          {leftPane.node}
        </ShellDrawer>
      ) : null}

      {hasInspectorDrawer ? (
        <ShellDrawer
          id="inspector"
          side="right"
          label={hu.shell.aiInspectorAria}
          widthClass="w-inspector"
        >
          <InspectorPanel />
        </ShellDrawer>
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
          showTreeToggle={hasLeftDrawer}
          showInspectorToggle={hasInspectorDrawer}
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
