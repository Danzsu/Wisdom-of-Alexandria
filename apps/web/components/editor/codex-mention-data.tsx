"use client";

/**
 * Live data for the CodexMention hover popover.
 *
 * The Tiptap NodeView ({@link CodexMentionView}) reads the resolved mention from
 * this context. The Write screen mounts {@link CodexMentionDataProvider} with the
 * REAL project Codex (resolved from `bookId` → project id → codex list), so the
 * popover shows real names/types/descriptions and the "Megnyitás a Codexben →"
 * link navigates to the real entry. When no provider is mounted (e.g. the
 * extension unit harness) the consumer falls back to the static placeholder map,
 * preserving the pre-M6 behaviour.
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useBookProjectId } from "@/lib/api/ai-hooks";
import { useCodexEntries } from "@/lib/api/hooks";
import {
  buildCodexMentionIndex,
  type CodexMentionIndex,
} from "./codex-data";

/** Null = no provider mounted (consumers fall back to the static map). */
const CodexMentionDataContext = createContext<CodexMentionIndex | null>(null);

/** Read the live mention index (or null when no provider is mounted). */
export function useCodexMentionIndex(): CodexMentionIndex | null {
  return useContext(CodexMentionDataContext);
}

export interface CodexMentionDataProviderProps {
  /** The active book id (codex is resolved through its owning project). */
  bookId: string | undefined;
  children: ReactNode;
}

/**
 * Provide the label-keyed mention index built from the real project Codex.
 * Resolves the owning project id via the reused M5 resolver, lists its codex
 * entries, and memoises the index. Query errors do not throw here (the popover
 * gracefully shows nothing for an unresolved label); they still surface in the
 * Codex screen itself.
 */
export function CodexMentionDataProvider({
  bookId,
  children,
}: CodexMentionDataProviderProps) {
  const projectIdQuery = useBookProjectId(bookId);
  const codex = useCodexEntries(projectIdQuery.data);

  const index = useMemo(
    () => buildCodexMentionIndex(codex.data ?? []),
    [codex.data],
  );

  return (
    <CodexMentionDataContext.Provider value={index}>
      {children}
    </CodexMentionDataContext.Provider>
  );
}
