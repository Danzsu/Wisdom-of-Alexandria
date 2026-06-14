"use client";

import { Info } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { hu } from "@/lib/i18n/hu";

/**
 * Figyelmeztetések (Warnings) tab. Continuity checking is RAG-backed and lands
 * in M10 (the backend continuity engine does not exist yet), so this renders an
 * honest empty state pointing to M10 — it does NOT fabricate a continuity
 * engine or fake warnings.
 */
export function WarningsTab() {
  return (
    <div className="flex flex-col gap-3.5">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {hu.inspector.warningsLabel}
      </p>
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-muted px-4 py-8 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-text-faint">
          <Icon icon={Info} size={18} />
        </span>
        <p className="m-0 text-[13px] font-semibold text-text">
          {hu.inspector.warningsEmptyTitle}
        </p>
        <p className="m-0 max-w-[240px] text-[12px] leading-[1.5] text-text-muted">
          {hu.inspector.warningsEmptyHint}
        </p>
      </div>
    </div>
  );
}
