"use client";

import { useState } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { MapPin } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import { resolveCodexMention } from "../codex-data";
import { useCodexMentionIndex } from "../codex-mention-data";

/**
 * NodeView for a CodexMention: a dotted-accent underline span that reveals a
 * hover popover card (avatar + name + type + description + "Megnyitás a
 * Codexben →"). Reuses kit popover styling tokens. Opens on hover and on
 * keyboard focus so the card is reachable without a pointer.
 */
export function CodexMentionView({ node, extension }: NodeViewProps) {
  const [open, setOpen] = useState(false);
  const label = String(node.attrs.label ?? "");
  const index = useCodexMentionIndex();
  const entry = resolveCodexMention(label, index);
  const onOpenCodex = extension.options.onOpenCodex as
    | ((id: string) => void)
    | undefined;

  return (
    <NodeViewWrapper
      as="span"
      className="relative inline-block"
      data-codex-mention=""
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={label}
        className="cursor-pointer border-b border-dotted border-accent text-text outline-none focus-visible:rounded-sm"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => entry && onOpenCodex?.(entry.id)}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && entry) {
            e.preventDefault();
            onOpenCodex?.(entry.id);
          }
        }}
      >
        {label}
      </span>

      {open && entry ? (
        <span
          role="tooltip"
          className="absolute bottom-[calc(100%+8px)] left-0 z-40 block w-[234px] font-sans not-italic"
        >
          <span className="block rounded-xl border border-border bg-surface p-3 shadow-popover">
            <span className="mb-[7px] flex items-center gap-[9px]">
              <span
                className={cn(
                  "flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-[11px] font-bold",
                  entry.kind === "location"
                    ? "bg-surface-muted text-text-muted"
                    : povSlotClass(entry.povSlot),
                )}
              >
                {entry.kind === "location" ? (
                  <Icon icon={MapPin} size={15} />
                ) : (
                  entry.initials
                )}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-text">
                  {entry.label}
                </span>
                <span className="block text-[11px] text-text-muted">
                  {entry.typeLine}
                </span>
              </span>
            </span>
            <span className="mb-2 block text-[12px] leading-[1.5] text-text-soft">
              {entry.description}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-accent-text">
              {hu.write.mentionOpenInCodex}
            </span>
          </span>
        </span>
      ) : null}
    </NodeViewWrapper>
  );
}

/** Map a POV slot (1–6) to its background/text token classes. */
function povSlotClass(slot: number | null): string {
  switch (slot) {
    case 1:
      return "bg-pov1-bg text-pov1-tx";
    case 2:
      return "bg-pov2-bg text-pov2-tx";
    case 3:
      return "bg-pov3-bg text-pov3-tx";
    case 4:
      return "bg-pov4-bg text-pov4-tx";
    case 5:
      return "bg-pov5-bg text-pov5-tx";
    case 6:
      return "bg-pov6-bg text-pov6-tx";
    default:
      return "bg-surface-muted text-text-muted";
  }
}
