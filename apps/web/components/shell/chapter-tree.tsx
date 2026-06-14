"use client";

import { BrandStar } from "@/components/kit/brand-star";
import { hu } from "@/lib/i18n/hu";

/**
 * 232px chapter-tree sidebar — Write route only. M2 ships a labelled
 * placeholder so the shell layout is verifiable; the real act/chapter/scene
 * tree (with navigation + drag) is filled in M4.
 */
export function ChapterTree() {
  return (
    <nav
      aria-label="Fejezetek"
      className="flex w-tree flex-none flex-col border-r border-border bg-bg-subtle"
    >
      <div className="px-3.5 pb-2 pt-3.5">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
          Fejezetek
        </span>
      </div>
      <div className="flex-1 px-3.5 text-[13px] text-text-faint">
        {/* Placeholder — chapter/scene tree arrives in M4. */}
        <p className="m-0">A fejezet-fa az M4-ben érkezik.</p>
      </div>
      <div className="flex flex-none items-center gap-[7px] border-t border-border px-3.5 py-3">
        <BrandStar size={11} className="opacity-70" />
        <span className="text-[10px] uppercase tracking-[0.1em] text-text-faint">
          {hu.brandFull}
        </span>
      </div>
    </nav>
  );
}
