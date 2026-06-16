"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Keyboard } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { useUIStore } from "@/lib/stores/ui-store";
import { SHORTCUT_GROUPS, type ShortcutEntry } from "@/lib/shortcut-data";
import { formatChord } from "@/lib/platform";
import { hu } from "@/lib/i18n/hu";

/** Render a chord as one or more key caps (e.g. ⌘ K, or Ctrl + K). */
function ChordKeys({ entry }: { entry: ShortcutEntry }) {
  // formatChord already resolves "Mod" + the platform separator; we split on the
  // separator to render individual caps. On Mac there's no separator, so each
  // raw token becomes its own cap.
  const isMac = formatChord(["Mod"]) === "⌘";
  const caps = isMac
    ? entry.keys.map((k) => (k === "Mod" ? "⌘" : k))
    : formatChord(entry.keys).split("+");
  return (
    <span className="flex items-center gap-1">
      {caps.map((cap, i) => (
        <kbd
          key={`${cap}-${i}`}
          className="flex h-[22px] min-w-[22px] items-center justify-center rounded-[5px] border border-border bg-surface-muted px-1.5 font-mono text-[11px] text-text-muted"
        >
          {cap}
        </kbd>
      ))}
    </span>
  );
}

/**
 * Keyboard-shortcuts help overlay (Radix Dialog — modal, focus-trapped,
 * Esc-to-close, titled). Lists the REAL shortcuts wired in the app, grouped by
 * area (Általános / Szerkesztő / AI). Key labels are platform-aware (⌘ on Mac,
 * Ctrl elsewhere). Open state lives in the shared UI store; the `?` hotkey (see
 * ShortcutsOverlayHotkey) and the command-palette row open it.
 */
export function ShortcutsOverlay() {
  const open = useUIStore((s) => s.shortcutsOpen);
  const close = useUIStore((s) => s.closeShortcuts);

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[55] bg-[rgba(24,18,9,.4)] [animation:woaFade_.16s_ease-out]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[56] w-[460px] max-w-[calc(100%-48px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[14px] border border-border bg-surface shadow-popover [animation:woaReveal_.18s_cubic-bezier(.22,1,.36,1)]"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Icon icon={Keyboard} size={16} className="text-accent" />
            <Dialog.Title className="m-0 flex-1 text-[14px] font-semibold text-text">
              {hu.shortcuts.title}
            </Dialog.Title>
          </div>
          <Dialog.Description className="sr-only">
            {hu.shortcuts.description}
          </Dialog.Description>

          <div className="flex flex-col gap-4 px-4 py-3.5">
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group.key} className="flex flex-col gap-1.5">
                <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.08em] text-text-faint">
                  {group.label}
                </p>
                {group.entries.map((entry) => (
                  <div
                    key={entry.label}
                    className="flex items-center gap-3 py-0.5"
                  >
                    <span className="flex-1 text-[13px] text-text-soft">
                      {entry.label}
                    </span>
                    <ChordKeys entry={entry} />
                  </div>
                ))}
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
