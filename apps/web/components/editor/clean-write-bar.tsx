"use client";

import type { Editor } from "@tiptap/react";
import {
  Sparkles,
  Wand2,
  Bold,
  Italic,
  Strikethrough,
  Highlighter,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { useEditorStore } from "@/lib/stores/editor-store";
import { hu } from "@/lib/i18n/hu";
import { cn } from "@/lib/utils";

/**
 * Clean-write ("Tiszta írás mód") banner + plain formatting bar. Shown only when
 * `aiFreeOn` is set: the banner explains the AI-free mode and offers to re-enable
 * AI; the bar exposes basic Tiptap formatting (H1/H2/Body, bold/italic/strike/
 * highlight, lists, quote). All actions are real editor commands.
 */
export function CleanWriteBar({ editor }: { editor: Editor | null }) {
  const setAiFree = useEditorStore((s) => s.setAiFree);

  const fmtBtn = (
    label: React.ReactNode,
    title: string,
    onClick: () => void,
    extra?: string,
  ) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        "flex h-[30px] items-center justify-center rounded-[7px] border-none bg-transparent px-2 text-text-soft hover:bg-surface-muted hover:text-text",
        extra,
      )}
    >
      {label}
    </button>
  );

  return (
    <>
      <div className="flex flex-none items-center gap-[9px] border-b border-border bg-surface-soft px-5 py-2">
        <Icon icon={Wand2} size={14} className="text-accent-text" />
        <span className="text-[13px] font-semibold text-text">
          {hu.write.cleanWriteTitle}
        </span>
        <span className="text-[12px] text-text-muted">
          {hu.write.cleanWriteHint}
        </span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setAiFree(false)}
          className="flex h-7 items-center gap-1.5 rounded-lg border border-border bg-surface px-[11px] text-[12px] text-text-soft hover:border-accent hover:bg-accent-muted hover:text-accent-text"
        >
          <Icon icon={Sparkles} size={12} className="fill-current" />
          {hu.write.cleanWriteEnableAi}
        </button>
      </div>

      <div className="flex flex-none items-center gap-[3px] border-b border-border bg-surface px-4 py-[7px]">
        {fmtBtn(
          "H1",
          hu.write.fmtH1Title,
          () => editor?.chain().focus().toggleHeading({ level: 1 }).run(),
          "font-serif text-[15px] font-bold",
        )}
        {fmtBtn(
          "H2",
          hu.write.fmtH2Title,
          () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
          "font-serif text-[13px] font-bold",
        )}
        {fmtBtn(
          hu.write.fmtBody,
          hu.write.fmtBodyTitle,
          () => editor?.chain().focus().setParagraph().run(),
          "text-[13px]",
        )}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        {fmtBtn(
          <Icon icon={Bold} size={15} />,
          hu.write.fmtBoldTitle,
          () => editor?.chain().focus().toggleBold().run(),
          "w-[30px]",
        )}
        {fmtBtn(
          <Icon icon={Italic} size={15} />,
          hu.write.fmtItalicTitle,
          () => editor?.chain().focus().toggleItalic().run(),
          "w-[30px]",
        )}
        {fmtBtn(
          <Icon icon={Strikethrough} size={15} />,
          hu.write.fmtStrikeTitle,
          () => editor?.chain().focus().toggleStrike().run(),
          "w-[30px]",
        )}
        {fmtBtn(
          <Icon icon={Highlighter} size={15} />,
          hu.write.fmtHighlightTitle,
          () => editor?.chain().focus().toggleHighlight().run(),
          "w-[30px]",
        )}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        {fmtBtn(
          <Icon icon={List} size={15} />,
          hu.write.fmtBulletTitle,
          () => editor?.chain().focus().toggleBulletList().run(),
          "w-[30px]",
        )}
        {fmtBtn(
          <Icon icon={ListOrdered} size={15} />,
          hu.write.fmtNumberTitle,
          () => editor?.chain().focus().toggleOrderedList().run(),
          "w-[30px]",
        )}
        {fmtBtn(
          <Icon icon={Quote} size={15} />,
          hu.write.fmtQuoteTitle,
          () => editor?.chain().focus().toggleBlockquote().run(),
          "w-[30px]",
        )}
      </div>
    </>
  );
}
