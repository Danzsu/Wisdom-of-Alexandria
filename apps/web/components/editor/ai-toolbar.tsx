"use client";

import type { Editor } from "@tiptap/react";
import {
  PenLine,
  Eye,
  RotateCcw,
  Lightbulb,
  Sparkles,
  Database,
  History,
  BookText,
  Image as ImageIcon,
  MessageSquare,
  Table as TableIcon,
  Maximize,
  MoreHorizontal,
  Check,
} from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { IconButton } from "@/components/kit/icon-button";
import {
  SplitButtonDropdown,
  type SplitMenuItem,
} from "@/components/kit/split-button-dropdown";
import {
  PopoverMenu,
  PopoverMenuTrigger,
  PopoverMenuContent,
  MenuRow,
  MenuSeparator,
} from "@/components/kit/popover-menu";
import { cn, formatHu } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import { useEditorStore } from "@/lib/stores/editor-store";
import { FormatMenu } from "./format-menu";

/** Action ids surfaced by the toolbar's menus. */
export type ToolbarAction =
  | "beat"
  | "continue"
  | "codex-progression"
  | "describe"
  | "rewrite"
  | "brainstorm"
  | "version-history"
  | "thesaurus"
  | "visualization"
  | "comment"
  | "insert-image"
  | "insert-table"
  | "scene-summarize"
  | "scene-detect"
  | "scene-chat"
  | "scene-subtitle"
  | "scene-duplicate"
  | "scene-export"
  | "history";

export interface AiToolbarProps {
  editor: Editor | null;
  onAction: (action: ToolbarAction) => void;
}

/**
 * The 48px AI toolbar above the manuscript. Hosts the Írás / Leírás / Átírás /
 * Ötletelés / Több split buttons, a divider, the Formátum rich menu, the Fókusz
 * toggle, comment / image / table icon buttons, a spacer, the scene kebab menu,
 * a history button, the live word count and the "✓ Mentve" indicator. Real AI
 * generation is M5: every AI action routes to `onAction`, which the page turns
 * into a stub toast.
 */
export function AiToolbar({ editor, onAction }: AiToolbarProps) {
  const focusOn = useEditorStore((s) => s.focusOn);
  const toggleFocus = useEditorStore((s) => s.toggleFocus);
  const wordCount = useEditorStore((s) => s.wordCount);
  const saveState = useEditorStore((s) => s.saveState);

  const writeItems: SplitMenuItem[] = [
    {
      id: "beat",
      label: hu.write.sceneBeat,
      subtitle: hu.write.sceneBeatHint,
      section: hu.write.groupAi,
      icon: <Icon icon={Sparkles} size={15} />,
    },
    {
      id: "continue",
      label: hu.write.continueWriting,
      subtitle: hu.write.continueWritingHint,
      section: hu.write.groupAi,
      icon: <Icon icon={PenLine} size={15} />,
    },
    {
      id: "codex-progression",
      label: hu.write.codexProgression,
      subtitle: hu.write.codexProgressionHint,
      section: hu.write.groupCodex,
      icon: <Icon icon={Database} size={15} />,
    },
  ];

  const describeItems: SplitMenuItem[] = [
    { id: "describe", label: hu.write.describe, icon: <Icon icon={Eye} size={15} /> },
  ];

  const moreItems: SplitMenuItem[] = [
    {
      id: "version-history",
      label: hu.write.versionHistory,
      icon: <Icon icon={History} size={14} />,
    },
    {
      id: "thesaurus",
      label: hu.write.thesaurus,
      icon: <Icon icon={BookText} size={14} />,
    },
    {
      id: "visualization",
      label: hu.write.visualization,
      icon: <Icon icon={ImageIcon} size={14} />,
    },
  ];

  const pill =
    "flex h-[30px] items-center gap-1.5 rounded-full border border-border bg-transparent px-3 text-[13px] text-text-soft transition-colors hover:border-accent hover:bg-accent-muted hover:text-accent-text";

  return (
    <div className="flex h-12 flex-none items-center gap-2 border-b border-border bg-surface px-5">
      <SplitButtonDropdown
        label={hu.write.write}
        leadingIcon={<Icon icon={PenLine} size={14} />}
        items={writeItems}
        onSelect={(id) => onAction(id as ToolbarAction)}
      />
      <SplitButtonDropdown
        label={hu.write.describe}
        leadingIcon={<Icon icon={Eye} size={14} />}
        items={describeItems}
        onSelect={(id) => onAction(id as ToolbarAction)}
      />
      <button type="button" className={pill} onClick={() => onAction("rewrite")}>
        <Icon icon={RotateCcw} size={14} />
        {hu.write.rewrite}
      </button>
      <button
        type="button"
        className={pill}
        onClick={() => onAction("brainstorm")}
      >
        <Icon icon={Lightbulb} size={14} />
        {hu.write.brainstorm}
      </button>
      <SplitButtonDropdown
        label={hu.write.more}
        items={moreItems}
        onSelect={(id) => onAction(id as ToolbarAction)}
      />

      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />

      <FormatMenu />

      <button
        type="button"
        aria-label={hu.write.focusAria}
        aria-pressed={focusOn}
        title={hu.write.focusTitle}
        data-state={focusOn ? "on" : "off"}
        onClick={toggleFocus}
        className={cn(
          "flex h-[30px] w-[30px] items-center justify-center rounded-full border border-border bg-transparent text-text-muted transition-colors hover:border-accent hover:bg-accent-muted hover:text-accent-text",
          focusOn && "border-accent bg-accent-muted text-accent-text",
        )}
      >
        <Icon icon={Maximize} size={15} />
      </button>

      <span className="mx-0.5 h-5 w-px bg-border" aria-hidden="true" />

      <IconButton
        aria-label={hu.write.commentAria}
        title={hu.write.commentTitle}
        onClick={() => onAction("comment")}
      >
        <Icon icon={MessageSquare} size={15} />
      </IconButton>
      <IconButton
        aria-label={hu.write.insertImageAria}
        title={hu.write.insertImageTitle}
        onClick={() => {
          editor?.chain().focus().insertImagePlaceholder().run();
          onAction("insert-image");
        }}
      >
        <Icon icon={ImageIcon} size={15} />
      </IconButton>
      <IconButton
        aria-label={hu.write.insertTableAria}
        title={hu.write.insertTableTitle}
        onClick={() => {
          editor?.chain().focus().insertManuscriptTable().run();
          onAction("insert-table");
        }}
      >
        <Icon icon={TableIcon} size={15} />
      </IconButton>

      <div className="flex-1" />

      <PopoverMenu>
        <PopoverMenuTrigger asChild>
          <IconButton
            aria-label={hu.write.sceneMenuAria}
            title={hu.write.sceneMenuTitle}
          >
            <Icon icon={MoreHorizontal} size={16} />
          </IconButton>
        </PopoverMenuTrigger>
        <PopoverMenuContent align="end" className="min-w-[230px]">
          <MenuRow
            leadingIcon={<Icon icon={BookText} size={14} />}
            onSelect={() => onAction("scene-summarize")}
          >
            {hu.write.scSummarize}
          </MenuRow>
          <MenuRow
            leadingIcon={<Icon icon={Sparkles} size={14} />}
            onSelect={() => onAction("scene-detect")}
          >
            {hu.write.scDetect}
          </MenuRow>
          <MenuRow
            leadingIcon={<Icon icon={MessageSquare} size={14} />}
            onSelect={() => onAction("scene-chat")}
          >
            {hu.write.scChat}
          </MenuRow>
          <MenuSeparator />
          <MenuRow onSelect={() => onAction("scene-subtitle")}>
            {hu.write.scSubtitle}
          </MenuRow>
          <MenuRow onSelect={() => onAction("scene-duplicate")}>
            {hu.write.scDuplicate}
          </MenuRow>
          <MenuRow onSelect={() => onAction("scene-export")}>
            {hu.write.scExport}
          </MenuRow>
        </PopoverMenuContent>
      </PopoverMenu>

      <IconButton
        aria-label={hu.write.historyAria}
        title={hu.write.historyTitle}
        onClick={() => onAction("history")}
      >
        <Icon icon={History} size={15} />
      </IconButton>

      <span className="text-[12px] tabular-nums text-text-muted">
        {hu.statusbar.wordCount(formatHu(wordCount))}
      </span>
      <span className="text-border-strong" aria-hidden="true">
        ·
      </span>
      {/* Live region so autosave failures ("Mentés sikertelen") are announced. */}
      <span role="status" aria-live="polite" className="flex items-center">
        <SaveIndicator saveState={saveState} />
      </span>
    </div>
  );
}

/** Compact save-state indicator shown at the end of the toolbar. */
function SaveIndicator({ saveState }: { saveState: string }) {
  if (saveState === "saving") {
    return (
      <span className="flex items-center gap-1 text-[12px] text-text-muted">
        {hu.statusbar.saving}
      </span>
    );
  }
  if (saveState === "error") {
    return (
      <span className="flex items-center gap-1 text-[12px] text-danger-text">
        {hu.statusbar.error}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[12px] text-success-text">
      <Icon icon={Check} size={13} strokeWidth={2} />
      {hu.write.saved}
    </span>
  );
}
