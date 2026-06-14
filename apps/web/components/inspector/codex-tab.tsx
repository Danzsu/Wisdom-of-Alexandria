"use client";

import { ChevronRight, MapPin, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/kit/icon";
import { hu } from "@/lib/i18n/hu";
import { routes } from "@/lib/routes";
import { useBookProjectId } from "@/lib/api/ai-hooks";
import { useCodexEntries } from "@/lib/api/hooks";
import { useInspectorScene } from "./use-inspector-scene";

/**
 * Codex tab: the project's Codex entries (the "in this scene" list). Full
 * mention detection is M6; for MVP this lists the real project Codex entries
 * (read-only) and links each into the Codex screen. Empty / loading / error are
 * surfaced honestly.
 */
export function CodexTab() {
  const router = useRouter();
  const { bookId } = useInspectorScene();
  const projectIdQuery = useBookProjectId(bookId);
  const codex = useCodexEntries(projectIdQuery.data);

  const openCodex = () => {
    if (bookId) router.push(routes.book(bookId, "codex"));
  };

  const entries = codex.data ?? [];

  return (
    <div className="flex flex-col gap-3.5">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">
        {hu.inspector.codexInSceneLabel}
      </p>

      {codex.isError || projectIdQuery.isError ? (
        <p className="m-0 text-[12px] text-danger-text" role="alert">
          {(codex.error ?? projectIdQuery.error)?.message}
        </p>
      ) : entries.length === 0 ? (
        <p className="m-0 text-[12px] text-text-muted">
          {hu.inspector.codexEmpty}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          {entries.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={openCodex}
              className="flex items-center gap-2.5 rounded-[10px] border border-border bg-surface p-2 text-left hover:bg-surface-muted"
            >
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-surface-muted text-text-muted">
                <Icon
                  icon={entry.entry_type === "location" ? MapPin : User}
                  size={13}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-text">
                  {entry.title}
                </span>
                <span className="block text-[11px] text-text-muted">
                  {entry.entry_type}
                </span>
              </span>
              <Icon
                icon={ChevronRight}
                size={12}
                className="text-text-faint"
              />
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={openCodex}
        className="h-8 rounded-lg border border-dashed border-border-strong bg-transparent text-[12px] text-text-muted hover:border-accent hover:bg-accent-muted hover:text-accent-text"
      >
        {hu.inspector.codexOpenInCodex}
      </button>
    </div>
  );
}
