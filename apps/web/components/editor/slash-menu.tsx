"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import {
  Sparkles,
  PenLine,
  Database,
  Heading1,
  Heading2,
  Bold,
  Italic,
  Quote,
  Minus,
} from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { MenuSection } from "@/components/kit/popover-menu";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";

/** A slash-menu item. `run` receives the editor (selection already cleaned). */
export interface SlashItem {
  id: string;
  label: string;
  section: string;
  icon: typeof Sparkles;
  run: (editor: Editor) => void;
}

export interface SlashMenuCallbacks {
  /** Insert a beat card (config state). */
  onBeat: (editor: Editor) => void;
  /** Trigger the "continue writing" action (M5 stub). */
  onContinue: (editor: Editor) => void;
  /** Trigger the codex-progression action (M5 stub / route). */
  onCodexProgression: (editor: Editor) => void;
}

/** Build the slash command list (sections AI / Codex / Formázás). */
export function buildSlashItems(cb: SlashMenuCallbacks): SlashItem[] {
  return [
    {
      id: "beat",
      label: hu.write.sceneBeat,
      section: hu.write.groupAi,
      icon: Sparkles,
      run: cb.onBeat,
    },
    {
      id: "continue",
      label: hu.write.continueWriting,
      section: hu.write.groupAi,
      icon: PenLine,
      run: cb.onContinue,
    },
    {
      id: "codex-progression",
      label: hu.write.codexProgression,
      section: hu.write.groupCodex,
      icon: Database,
      run: cb.onCodexProgression,
    },
    {
      id: "h1",
      label: hu.write.slashH1,
      section: hu.write.groupFormatting,
      icon: Heading1,
      run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      id: "h2",
      label: hu.write.slashH2,
      section: hu.write.groupFormatting,
      icon: Heading2,
      run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      id: "bold",
      label: hu.write.slashBold,
      section: hu.write.groupFormatting,
      icon: Bold,
      run: (e) => e.chain().focus().toggleBold().run(),
    },
    {
      id: "italic",
      label: hu.write.slashItalic,
      section: hu.write.groupFormatting,
      icon: Italic,
      run: (e) => e.chain().focus().toggleItalic().run(),
    },
    {
      id: "quote",
      label: hu.write.slashQuote,
      section: hu.write.groupFormatting,
      icon: Quote,
      run: (e) => e.chain().focus().toggleBlockquote().run(),
    },
    {
      id: "separator",
      label: hu.write.slashSeparator,
      section: hu.write.groupFormatting,
      icon: Minus,
      run: (e) => e.chain().focus().setHorizontalRule().run(),
    },
  ];
}

/** Read the text immediately before the cursor on the current text block. */
function textBeforeCursor(editor: Editor): string {
  const { from, empty } = editor.state.selection;
  if (!empty) return "";
  const $from = editor.state.selection.$from;
  const start = $from.start();
  return editor.state.doc.textBetween(start, from, "\n", "\0");
}

/**
 * Slash command menu. Watches the editor: when the user types `/` at the start
 * of an empty line (or after whitespace) it opens a keyboard-navigable menu
 * (PopoverMenu styling). Selecting an item deletes the trigger `/` then runs the
 * command. Esc / blur / typing past the trigger closes it.
 */
export function SlashMenu({
  editor,
  callbacks,
}: {
  editor: Editor | null;
  callbacks: SlashMenuCallbacks;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  // Memoize so the keydown listener effect (which depends on `items`) doesn't
  // resubscribe on every render.
  const items = useMemo(() => buildSlashItems(callbacks), [callbacks]);
  const triggerPosRef = useRef<number | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setActive(0);
    triggerPosRef.current = null;
  }, []);

  const runItem = useCallback(
    (item: SlashItem) => {
      if (!editor) return;
      const pos = triggerPosRef.current;
      // Remove the trigger "/" then run the command.
      if (pos != null) {
        editor.chain().focus().deleteRange({ from: pos, to: pos + 1 }).run();
      }
      item.run(editor);
      close();
    },
    [editor, close],
  );

  // Watch selection/content for the trigger.
  useEffect(() => {
    if (!editor) return;
    const handleUpdate = () => {
      const before = textBeforeCursor(editor);
      const lastChar = before.slice(-1);
      const prevChar = before.slice(-2, -1);
      const isTrigger =
        lastChar === "/" && (before.length === 1 || prevChar === " ");
      if (isTrigger) {
        triggerPosRef.current = editor.state.selection.from - 1;
        setActive(0);
        setOpen(true);
      } else if (open && !before.endsWith("/")) {
        close();
      }
    };
    editor.on("update", handleUpdate);
    editor.on("selectionUpdate", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
      editor.off("selectionUpdate", handleUpdate);
    };
  }, [editor, open, close]);

  // Keyboard navigation while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => (a + 1) % items.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => (a - 1 + items.length) % items.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        runItem(items[active]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, active, items, runItem, close]);

  if (!open) return null;

  let lastSection: string | undefined;

  return (
    <div
      role="menu"
      tabIndex={-1}
      aria-label={hu.write.slashMenuAria}
      aria-activedescendant={
        items[active] ? `slash-item-${items[active].id}` : undefined
      }
      className="absolute left-8 top-12 z-50 flex w-[234px] flex-col gap-px rounded-xl border border-border bg-surface p-[5px] shadow-popover [animation:woaToastIn_.15s_ease-out]"
    >
      {items.map((item, index) => {
        const showSection = item.section !== lastSection;
        lastSection = item.section;
        return (
          <div key={item.id} className="contents">
            {showSection ? (
              <MenuSection label={item.section} className="px-2.5 pb-1 pt-1.5" />
            ) : null}
            <button
              id={`slash-item-${item.id}`}
              type="button"
              role="menuitem"
              data-active={index === active ? "true" : undefined}
              className={cn(
                "flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-text-soft outline-none transition-colors hover:bg-surface-muted hover:text-text",
                index === active && "bg-surface-muted text-text",
              )}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(e) => {
                // Keep the editor selection; run on mousedown before blur.
                e.preventDefault();
                runItem(item);
              }}
            >
              <span className="flex flex-none items-center text-accent">
                <Icon icon={item.icon} size={15} />
              </span>
              <span className="flex-1 truncate">{item.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
