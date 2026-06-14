"use client";

import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { RotateCcw, Eye, ChevronsUpDown, Database, Music } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { BrandStar } from "@/components/kit/brand-star";
import { hu } from "@/lib/i18n/hu";

/** Action ids the bubble menu can fire. */
export type BubbleAction =
  | "rewrite"
  | "describe"
  | "expand"
  | "visualize"
  | "ai"
  | "codex"
  | "audio";

export interface SelectionBubbleMenuProps {
  editor: Editor;
  /** Fired with the chosen action id. AI actions are stubbed in the page (M5). */
  onAction: (action: BubbleAction) => void;
}

/** A single pill button inside the bubble toolbar. */
function PillAction({
  label,
  icon,
  onClick,
  ariaLabel,
  iconOnly,
  tone = "soft",
}: {
  label?: string;
  icon: typeof RotateCcw;
  onClick: () => void;
  ariaLabel?: string;
  iconOnly?: boolean;
  tone?: "soft" | "ai" | "accent";
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel ?? label}
      onClick={onClick}
      className={
        iconOnly
          ? `flex h-7 w-7 items-center justify-center rounded-full border-none bg-transparent ${
              tone === "ai"
                ? "text-ai hover:bg-ai-muted"
                : "text-accent-text hover:bg-accent-muted"
            }`
          : "flex h-7 items-center gap-[5px] rounded-full border-none bg-transparent px-[11px] text-[13px] text-text-soft hover:bg-surface-muted hover:text-text"
      }
    >
      {tone === "ai" ? (
        <BrandStar size={14} />
      ) : (
        <Icon icon={icon} size={13} />
      )}
      {!iconOnly ? label : null}
    </button>
  );
}

/**
 * SelectionBubbleMenu — a floating pill toolbar shown over a text selection
 * (Tiptap BubbleMenu). Actions: Átírás / Leírás / Bővítés / Vizualizáció, an AI
 * sparkle, Codexbe, and a ♪ audio-attach (stub). AI actions route to `onAction`,
 * which the page turns into the M5 stub toast — no model is called in M4.
 */
export function SelectionBubbleMenu({
  editor,
  onAction,
}: SelectionBubbleMenuProps) {
  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: "top" }}
    >
      <div
        role="toolbar"
        aria-label={hu.write.bubbleMenuAria}
        className="flex items-center gap-0.5 rounded-full border border-border bg-surface p-1 font-sans not-italic shadow-popover"
      >
        <PillAction
          label={hu.write.bubbleRewrite}
          icon={RotateCcw}
          onClick={() => onAction("rewrite")}
        />
        <PillAction
          label={hu.write.bubbleDescribe}
          icon={Eye}
          onClick={() => onAction("describe")}
        />
        <PillAction
          label={hu.write.bubbleExpand}
          icon={ChevronsUpDown}
          onClick={() => onAction("expand")}
        />
        <PillAction
          label={hu.write.bubbleVisualize}
          icon={Eye}
          onClick={() => onAction("visualize")}
        />
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        <PillAction
          icon={RotateCcw}
          iconOnly
          tone="ai"
          ariaLabel={hu.write.bubbleAiAria}
          onClick={() => onAction("ai")}
        />
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden="true" />
        <PillAction
          label={hu.write.bubbleCodex}
          icon={Database}
          onClick={() => onAction("codex")}
        />
        <PillAction
          icon={Music}
          iconOnly
          tone="accent"
          ariaLabel={hu.write.bubbleAudioAria}
          onClick={() => onAction("audio")}
        />
      </div>
    </BubbleMenu>
  );
}
