"use client";

import { useState } from "react";
import { Download, Music, Play } from "lucide-react";
import { Button } from "@/components/kit/button";
import { SectionEyebrow } from "@/components/kit/section-eyebrow";
import { TypedRadioGroup } from "@/components/kit/radio-group";
import { ToggleSwitch } from "@/components/kit/toggle-switch";
import { toast } from "@/components/kit/toast";
import { hu } from "@/lib/i18n/hu";
import { markdownFilename } from "@/lib/slugify";
import { useExportMarkdown } from "@/lib/api/export-hooks";
import { ExportFormatGrid, type ExportFormat } from "./export-format-grid";

/** Export scope. Only `book` hits the real endpoint; chapter/scene are V1. */
type ExportScope = "book" | "chapter" | "scene";

export interface ExportTabProps {
  bookId: string;
  /** Resolved book title (drives the filename preview + ASCII-fold fallback). */
  title: string;
}

/**
 * The EXPORT tab body: format grid + scope radios + filename preview + the V2
 * audio accordion + the real Markdown export button. Markdown + book scope are
 * wired to the backend; everything else is an honest stub.
 */
export function ExportTab({ bookId, title }: ExportTabProps) {
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [scope, setScope] = useState<ExportScope>("book");
  const [audioOpen, setAudioOpen] = useState(false);

  const exportMutation = useExportMarkdown();
  const filename = markdownFilename(title);

  function handleExport() {
    if (format !== "markdown") {
      toast.info(hu.exportScreen.formatStubToast(formatDisplayName(format)));
      return;
    }
    if (scope !== "book") {
      toast.info(hu.exportScreen.scopeV1Note);
      return;
    }
    exportMutation.mutate(
      { bookId, title },
      {
        onSuccess: (result) => {
          toast.success(hu.exportScreen.exportSuccess(result.filename));
        },
        onError: (error) => {
          toast.error(hu.exportScreen.exportError, {
            description: error.message,
          });
        },
      },
    );
  }

  return (
    <div>
      <p className="mb-5 text-[13px] text-text-muted">{hu.exportScreen.intro}</p>

      <SectionEyebrow as="h3" className="mb-2">
        {hu.exportScreen.formatLabel}
      </SectionEyebrow>
      <div className="mb-6">
        <ExportFormatGrid selected={format} onSelect={setFormat} />
      </div>

      <SectionEyebrow as="h3" className="mb-2">
        {hu.exportScreen.scopeLabel}
      </SectionEyebrow>
      {/* When book scope is selected there is no V1 note, so the radio group
          itself carries the bottom margin that the note would otherwise add. */}
      <div className={scope === "book" ? "mb-7" : "mb-2"}>
        <TypedRadioGroup<ExportScope>
          aria-label={hu.exportScreen.scopeLabel}
          value={scope}
          onValueChange={setScope}
          options={[
            { value: "book", label: hu.exportScreen.scopeBook(title) },
            { value: "chapter", label: hu.exportScreen.scopeChapter },
            { value: "scene", label: hu.exportScreen.scopeScene },
          ]}
        />
      </div>
      {scope === "book" ? null : (
        <p className="mb-5 text-[12px] text-warning-text">
          {hu.exportScreen.scopeV1Note}
        </p>
      )}

      <div className="mb-5 flex items-center gap-2 rounded-[10px] border border-border bg-surface-muted px-3 py-2.5">
        <span className="text-[11px] text-text-muted">
          {hu.exportScreen.filenameLabel}
        </span>
        <span className="font-mono text-[12px] text-text-soft">{filename}</span>
      </div>

      <SectionEyebrow as="h3" className="mb-2">
        {hu.exportScreen.audioLabel}
      </SectionEyebrow>
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-surface shadow-card">
        <button
          type="button"
          aria-expanded={audioOpen}
          onClick={() => setAudioOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-surface-muted"
        >
          <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[9px] bg-accent-muted text-accent-text">
            <Music size={16} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-text">
              {hu.exportScreen.audioTitle}
            </span>
            <span className="mt-px block text-[12px] text-text-muted">
              {hu.exportScreen.audioHint}
            </span>
          </span>
          <ToggleSwitch
            aria-label={hu.exportScreen.audioToggleAria}
            checked={audioOpen}
            onCheckedChange={setAudioOpen}
          />
        </button>
        {audioOpen ? (
          <div className="flex flex-col gap-px border-t border-border p-1.5">
            <div className="flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] text-text-soft">
              <Play size={13} className="fill-accent text-accent" aria-hidden="true" />
              <span className="flex-1">{hu.exportScreen.audioRow1Title}</span>
              <span className="text-[11px] text-text-muted">
                {hu.exportScreen.audioRow1Meta}
              </span>
            </div>
            <div className="flex items-center gap-2.5 px-2.5 py-1.5 text-[13px] text-text-soft">
              <Play size={13} className="fill-accent text-accent" aria-hidden="true" />
              <span className="flex-1">{hu.exportScreen.audioRow2Title}</span>
              <span className="text-[11px] text-text-muted">
                {hu.exportScreen.audioRow2Meta}
              </span>
            </div>
            <p className="mx-2.5 mb-1 mt-1.5 text-[11px] text-text-muted">
              {hu.exportScreen.audioFootnote}
            </p>
            <p className="mx-2.5 mb-1 text-[11px] text-warning-text">
              {hu.exportScreen.audioV2Note}
            </p>
          </div>
        ) : null}
      </div>

      <Button
        type="button"
        variant="cta"
        className="h-10 w-full"
        disabled={exportMutation.isPending}
        onClick={handleExport}
      >
        <Download size={15} aria-hidden="true" />
        {exportMutation.isPending
          ? hu.exportScreen.exporting
          : hu.exportScreen.exportCta}
      </Button>
      <p className="mt-2.5 text-center text-[11px] text-text-muted">
        {hu.exportScreen.backupNote}
      </p>
    </div>
  );
}

/** Human-facing display name for a format (used in the stub toast). */
function formatDisplayName(format: ExportFormat): string {
  switch (format) {
    case "docx":
      return hu.exportScreen.fmtDocx;
    case "epub":
      return hu.exportScreen.fmtEpub;
    case "pdf":
      return hu.exportScreen.fmtPdf;
    case "txt":
      return hu.exportScreen.fmtTxt;
    default:
      return hu.exportScreen.fmtMarkdown;
  }
}
