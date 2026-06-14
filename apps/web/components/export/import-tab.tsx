"use client";

import { Upload, Info } from "lucide-react";
import { DashedTile } from "@/components/kit/dashed-tile";
import { SectionEyebrow } from "@/components/kit/section-eyebrow";
import { toast } from "@/components/kit/toast";
import { hu } from "@/lib/i18n/hu";

/**
 * The IMPORT tab body — a V1 visual stub. A dashed dropzone (no real upload),
 * the supported-format list and the AI Codex-extract note. Any interaction
 * surfaces an honest "(V1-ben érkezik)" toast.
 */
export function ImportTab() {
  return (
    <div>
      <p className="mb-[18px] text-[13px] text-text-muted">
        {hu.exportScreen.importIntroBefore}
        <strong className="font-semibold text-text-soft">
          {hu.exportScreen.importIntroStrong}
        </strong>
        {hu.exportScreen.importIntroAfter}
      </p>

      <DashedTile
        size="import"
        className="mb-[22px]"
        icon={<Upload size={30} strokeWidth={1.4} aria-hidden="true" />}
        label={hu.exportScreen.importDropTitle}
        hint={hu.exportScreen.importDropHint}
        onClick={() => toast.info(hu.exportScreen.importToast)}
      />

      <SectionEyebrow as="h3" className="mb-2">
        {hu.exportScreen.importFormatsLabel}
      </SectionEyebrow>
      <div className="mb-[22px] grid grid-cols-2 gap-2">
        {hu.exportScreen.importFormats.map((fmt) => (
          <div
            key={fmt.badge}
            className="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface px-3 py-2.5"
          >
            <span className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg bg-surface-muted text-[10px] font-bold text-text-soft">
              {fmt.badge}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-text">
                {fmt.name}
              </span>
              <span className="block text-[11px] text-text-muted">
                {fmt.hint}
              </span>
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2.5 rounded-[10px] border border-border border-l-[3px] border-l-ai bg-surface px-3.5 py-3">
        <Info
          size={15}
          className="mt-px flex-none text-ai"
          aria-hidden="true"
        />
        <p className="text-[12px] leading-relaxed text-text-soft">
          {hu.exportScreen.importAiNote}
        </p>
      </div>
    </div>
  );
}
