"use client";

import { Check } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { hu } from "@/lib/i18n/hu";

/**
 * 32px footer status bar, rendered only on the Write route. Shows a word-count
 * placeholder, the current chapter/scene location, and a "Mentve" save state
 * in the success tone. The numbers are static placeholders for M2 — the live
 * word count + autosave state arrive with the editor in M4.
 */
export function StatusBar() {
  return (
    <footer className="flex h-statusbar flex-none items-center gap-3 border-t border-border bg-surface px-4 text-[12px] text-text-muted">
      <span className="tabular-nums">{hu.statusbar.wordCountPlaceholder}</span>
      <span aria-hidden="true" className="text-border-strong">
        ·
      </span>
      <span>{hu.statusbar.locationPlaceholder}</span>
      <div className="flex-1" />
      <span className="flex items-center gap-1 text-success-text">
        <Icon icon={Check} size={12} strokeWidth={2} />
        {hu.statusbar.saved}
      </span>
      <div className="flex-1" />
    </footer>
  );
}
