"use client";

import { Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";

/** The export formats. Only `markdown` is real (MVP); the rest are stubs. */
export type ExportFormat = "markdown" | "docx" | "epub" | "pdf" | "txt";

interface FormatCardDef {
  id: ExportFormat;
  label: string;
  hint: string;
  /** Whether the format is the real, wired one (only Markdown in the MVP). */
  real: boolean;
  /** Show the small "hang" media badge (EPUB). */
  audioBadge?: boolean;
}

const FORMAT_CARDS: FormatCardDef[] = [
  {
    id: "markdown",
    label: hu.exportScreen.fmtMarkdown,
    hint: hu.exportScreen.fmtMarkdownHint,
    real: true,
  },
  {
    id: "docx",
    label: hu.exportScreen.fmtDocx,
    hint: hu.exportScreen.fmtDocxHint,
    real: true,
  },
  {
    id: "epub",
    label: hu.exportScreen.fmtEpub,
    hint: hu.exportScreen.fmtEpubHint,
    real: true,
    audioBadge: true,
  },
  {
    id: "pdf",
    label: hu.exportScreen.fmtPdf,
    hint: hu.exportScreen.fmtPdfHint,
    real: true,
  },
  {
    id: "txt",
    label: hu.exportScreen.fmtTxt,
    hint: hu.exportScreen.fmtTxtHint,
    real: false,
  },
];

export interface ExportFormatGridProps {
  selected: ExportFormat;
  onSelect: (format: ExportFormat) => void;
}

/**
 * 2-column format grid. The selected card gets the accent border + muted accent
 * fill; non-real formats render a "hamarosan" badge and a muted look but stay
 * selectable (selecting one surfaces the stub note + disables the real export).
 */
export function ExportFormatGrid({ selected, onSelect }: ExportFormatGridProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {FORMAT_CARDS.map((card) => {
        const isSelected = card.id === selected;
        return (
          <button
            key={card.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(card.id)}
            className={cn(
              "flex flex-col gap-1 rounded-xl border p-3.5 text-left font-sans transition-colors",
              isSelected
                ? "border-accent bg-accent-muted"
                : "border-border bg-surface hover:border-border-strong",
            )}
          >
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "text-[14px] font-semibold",
                  isSelected ? "text-accent-text" : "text-text",
                )}
              >
                {card.label}
              </span>
              {card.audioBadge ? (
                <span className="flex h-4 items-center gap-[3px] rounded-full bg-accent-muted px-1.5 text-[10px] font-semibold text-accent-text">
                  <Music size={9} aria-hidden="true" />
                  {hu.exportScreen.fmtEpubBadge}
                </span>
              ) : null}
              {!card.real ? (
                <span className="flex h-4 items-center rounded-full bg-surface-muted px-1.5 text-[10px] font-semibold text-text-muted">
                  {hu.exportScreen.fmtComingBadge}
                </span>
              ) : null}
            </span>
            <span className="text-[12px] text-text-muted">{card.hint}</span>
          </button>
        );
      })}
    </div>
  );
}
