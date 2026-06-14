"use client";

import { useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useTheme } from "next-themes";
import { Search, SearchX, PenLine, Download, Moon, Plus } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { Avatar } from "@/components/kit/avatar";
import { useNavTo } from "@/lib/use-nav-to";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  COMMAND_RESULTS,
  filterCommands,
  type CommandGroupKey,
  type CommandResult,
} from "@/lib/command-data";
import { hu } from "@/lib/i18n/hu";

const GROUP_LABEL: Record<CommandGroupKey, string> = {
  scenes: hu.command.groupScenes,
  codex: hu.command.groupCodex,
  actions: hu.command.groupActions,
};

const GROUP_ORDER: CommandGroupKey[] = ["scenes", "codex", "actions"];

/** Leading visual for a result row. */
function ResultLeading({ result }: { result: CommandResult }) {
  if (result.group === "codex") {
    return <Avatar name={result.label} size={24} color={2} />;
  }
  if (result.action === "theme") {
    return <Icon icon={Moon} size={14} className="text-accent" />;
  }
  if (result.action === "export" || result.href?.includes("/export")) {
    return <Icon icon={Download} size={14} className="text-accent" />;
  }
  return <Icon icon={PenLine} size={14} className="text-accent" />;
}

/**
 * Top-anchored command palette built on Radix Dialog (modal, focus-trapped,
 * Esc-to-close). Open state lives in the shared UI store; a global Cmd/Ctrl+K
 * handler (see CommandPaletteHotkey) toggles it. The live query filters static
 * placeholder results into the Jelenetek / Codex / Műveletek groups; a result
 * navigates (or runs an action) and closes. Empty matches show the no-results
 * state with a "Létrehozás" affordance.
 */
export function CommandPalette() {
  const commandOpen = useUIStore((s) => s.commandOpen);
  const closeCommand = useUIStore((s) => s.closeCommand);
  const navTo = useNavTo();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState("");

  const results = useMemo(() => filterCommands(COMMAND_RESULTS, query), [query]);
  const hasResults = results.length > 0;

  const grouped = useMemo(() => {
    return GROUP_ORDER.map((key) => ({
      key,
      items: results.filter((r) => r.group === key),
    })).filter((g) => g.items.length > 0);
  }, [results]);

  function handleOpenChange(open: boolean) {
    if (!open) {
      closeCommand();
      // Reset the query so the next open starts clean.
      setQuery("");
    }
  }

  function runResult(result: CommandResult) {
    if (result.action === "theme") {
      setTheme(resolvedTheme === "dark" ? "light" : "dark");
      closeCommand();
      setQuery("");
      return;
    }
    if (result.href) {
      navTo(result.href);
      setQuery("");
      return;
    }
    // No href and no known action: close defensively rather than no-op silently.
    closeCommand();
    setQuery("");
  }

  return (
    <Dialog.Root open={commandOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[55] bg-[rgba(24,18,9,.4)] [animation:woaFade_.16s_ease-out]" />
        <Dialog.Content
          aria-label={hu.topbar.searchAria}
          onOpenAutoFocus={(e) => {
            // Keep default focus behaviour but ensure the input is focused.
            e.preventDefault();
            const input = document.getElementById("command-palette-input");
            if (input instanceof HTMLInputElement) input.focus();
          }}
          className="fixed left-1/2 top-20 z-[56] w-[520px] max-w-[calc(100%-48px)] -translate-x-1/2 overflow-hidden rounded-[14px] border border-border bg-surface shadow-popover [animation:woaReveal_.18s_cubic-bezier(.22,1,.36,1)]"
        >
          <Dialog.Title className="sr-only">{hu.topbar.searchAria}</Dialog.Title>
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-[13px]">
            <Icon icon={Search} size={16} className="text-text-muted" />
            <input
              id="command-palette-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={hu.command.placeholder}
              className="min-w-0 flex-1 border-none bg-transparent text-[14px] text-text outline-none placeholder:text-text-faint"
            />
            <span className="flex h-5 items-center rounded-[5px] border border-border px-1.5 font-mono text-[10px] text-text-muted">
              {hu.command.escHint}
            </span>
          </div>

          {hasResults ? (
            <div className="flex flex-col gap-px p-[7px]">
              {grouped.map((group) => (
                <div key={group.key} className="flex flex-col gap-px">
                  <p className="mb-[3px] mt-[5px] px-[9px] text-[10px] font-semibold uppercase tracking-[0.08em] text-text-faint">
                    {GROUP_LABEL[group.key]}
                  </p>
                  {group.items.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => runResult(result)}
                      className="flex items-center gap-2.5 rounded-lg px-[9px] py-2 text-left transition-colors hover:bg-surface-muted"
                    >
                      <ResultLeading result={result} />
                      <span className="flex-1 text-[13px] text-text">
                        {result.label}
                      </span>
                      {result.meta ? (
                        <span className="text-[11px] text-text-muted">
                          {result.meta}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-[9px] px-5 pb-[38px] pt-[34px] text-center">
              <span className="flex h-[46px] w-[46px] items-center justify-center rounded-[13px] bg-surface-muted text-text-faint">
                <Icon icon={SearchX} size={22} strokeWidth={1.6} />
              </span>
              <p className="m-0 text-[14px] font-semibold text-text">
                {hu.command.noResultsPrefix}
                {"„"}
                {query}
                {"”"}
              </p>
              <p className="m-0 max-w-[260px] text-[12px] leading-[1.5] text-text-muted">
                {hu.command.noResultsHint}
              </p>
              <button
                type="button"
                onClick={() => {
                  closeCommand();
                  setQuery("");
                }}
                className="mt-0.5 flex h-[30px] items-center gap-1.5 rounded-lg border border-accent bg-accent-muted px-[13px] text-[12px] font-semibold text-accent-text transition-colors hover:bg-accent-strong hover:text-accent-fg"
              >
                <Icon icon={Plus} size={12} />
                {hu.command.create}
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
