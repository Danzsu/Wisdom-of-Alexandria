"use client";

import { Type } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import {
  Popover,
  PopoverTrigger,
  PopoverPanel,
} from "@/components/kit/popover-menu";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import {
  useEditorStore,
  type EditorFont,
  type EditorWidth,
  type EditorSpacing,
} from "@/lib/stores/editor-store";

/** Toggle-row button used inside the format menu (font/width/spacing). */
function OptionButton({
  active,
  onClick,
  className,
  children,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-state={active ? "on" : "off"}
      onClick={onClick}
      className={cn(
        "rounded-lg border border-border bg-surface text-text-soft hover:border-border-strong",
        active && "border-accent bg-accent-muted text-accent-text",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Formátum ∨ — a rich popover (PopoverPanel) that mutates the editor-store:
 * font (Literata / Source Sans / Rendszer), size (−/+), column width
 * (Keskeny / Normál / Széles), spacing (Tömör / Lazább / Dupla) and the scene
 * separator row. The article styling reacts live to the store.
 */
export function FormatMenu() {
  const msFont = useEditorStore((s) => s.msFont);
  const fmSize = useEditorStore((s) => s.fmSize);
  const msWidth = useEditorStore((s) => s.msWidth);
  const fmSpacing = useEditorStore((s) => s.fmSpacing);
  const setFont = useEditorStore((s) => s.setFont);
  const decFontSize = useEditorStore((s) => s.decFontSize);
  const incFontSize = useEditorStore((s) => s.incFontSize);
  const setWidth = useEditorStore((s) => s.setWidth);
  const setSpacing = useEditorStore((s) => s.setSpacing);

  const fontOptions: { value: EditorFont; label: string; hint: string; fontClass: string }[] = [
    { value: "Literata", label: hu.write.fmFontLiterata, hint: hu.write.fmFontLiterataHint, fontClass: "font-serif" },
    { value: "Source Sans 3", label: hu.write.fmFontSans, hint: hu.write.fmFontSansHint, fontClass: "font-sans" },
    { value: "system", label: hu.write.fmFontSystem, hint: hu.write.fmFontSystemHint, fontClass: "[font-family:ui-sans-serif,system-ui,sans-serif]" },
  ];
  const widthOptions: { value: EditorWidth; label: string }[] = [
    { value: "narrow", label: hu.write.fmWidthNarrow },
    { value: "normal", label: hu.write.fmWidthNormal },
    { value: "wide", label: hu.write.fmWidthWide },
  ];
  const spacingOptions: { value: EditorSpacing; label: string }[] = [
    { value: "1.5", label: hu.write.fmSpacingTight },
    { value: "1.75", label: hu.write.fmSpacingLoose },
    { value: "2.1", label: hu.write.fmSpacingDouble },
  ];

  return (
    <Popover>
      <PopoverTrigger
        aria-label={hu.write.format}
        title={hu.write.format}
        className="flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full border border-border bg-transparent px-[11px] text-[13px] text-text-soft transition-colors hover:border-accent hover:bg-accent-muted hover:text-accent-text data-[state=open]:border-accent data-[state=open]:bg-accent-muted data-[state=open]:text-accent-text"
      >
        <Icon icon={Type} size={14} />
        {hu.write.format}
        <Icon icon={ChevronDown} size={11} />
      </PopoverTrigger>
      <PopoverPanel align="start" className="flex w-[280px] flex-col gap-3.5 p-3.5">
        {/* Font */}
        <div>
          <p className="m-0 mb-[7px] text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
            {hu.write.fmFontHeading}
          </p>
          <div className="flex flex-col gap-1">
            {fontOptions.map((opt) => (
              <OptionButton
                key={opt.value}
                active={msFont === opt.value}
                onClick={() => setFont(opt.value)}
                className={cn("flex h-[34px] items-center px-[11px] text-left text-[14px] text-text", opt.fontClass)}
              >
                {opt.label}
                <span className="ml-auto font-sans text-[11px] text-text-muted">
                  {opt.hint}
                </span>
              </OptionButton>
            ))}
          </div>
        </div>

        {/* Size */}
        <div className="flex items-center gap-2.5">
          <span className="flex-1 text-[13px] text-text">{hu.write.fmSizeLabel}</span>
          <button
            type="button"
            aria-label={hu.write.fmSizeDownAria}
            onClick={decFontSize}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface text-text-soft hover:bg-surface-muted"
          >
            −
          </button>
          <span className="w-[42px] text-center text-[13px] tabular-nums text-text">
            {fmSize}px
          </span>
          <button
            type="button"
            aria-label={hu.write.fmSizeUpAria}
            onClick={incFontSize}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-surface text-text-soft hover:bg-surface-muted"
          >
            +
          </button>
        </div>

        {/* Width */}
        <div>
          <p className="m-0 mb-[7px] text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
            {hu.write.fmWidthHeading}
          </p>
          <div className="flex gap-1">
            {widthOptions.map((opt) => (
              <OptionButton
                key={opt.value}
                active={msWidth === opt.value}
                onClick={() => setWidth(opt.value)}
                className="h-[30px] flex-1 text-[12px]"
              >
                {opt.label}
              </OptionButton>
            ))}
          </div>
        </div>

        {/* Spacing */}
        <div>
          <p className="m-0 mb-[7px] text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
            {hu.write.fmSpacingHeading}
          </p>
          <div className="flex gap-1">
            {spacingOptions.map((opt) => (
              <OptionButton
                key={opt.value}
                active={fmSpacing === opt.value}
                onClick={() => setSpacing(opt.value)}
                className="h-[30px] flex-1 text-[12px]"
              >
                {opt.label}
              </OptionButton>
            ))}
          </div>
        </div>

        {/* Scene separator */}
        <div className="flex items-center gap-2 border-t border-border pt-[11px]">
          <span className="flex-1 text-[13px] text-text">{hu.write.fmSeparatorLabel}</span>
          <span className="text-[15px] tracking-[0.3em] text-accent-text" aria-hidden="true">
            ⁂
          </span>
        </div>
      </PopoverPanel>
    </Popover>
  );
}
