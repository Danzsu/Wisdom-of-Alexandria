"use client";

/**
 * Selected-Codex-entry state, backed by the URL so the Codex SIDEBAR (mounted by
 * the AppShell) and the Codex PAGE (the `<main>` detail) — which live in separate
 * React subtrees — share one source of truth without a context spanning both.
 *
 * The selection lives in the `?entry=<id>` query param on the codex route. This
 * also makes the editor's "Megnyitás a Codexben →" mention deep-link work: it
 * navigates to `/konyv/{bookId}/codex?entry={id}` and the detail opens directly.
 */
import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface CodexSelection {
  /** The selected entry id, or null when none is selected. */
  selectedId: string | null;
  /** Select an entry (replaces the `?entry` param without a history push). */
  select: (entryId: string) => void;
  /** Clear the selection. */
  clear: () => void;
}

/** Read + write the selected codex entry id via the `?entry` query param. */
export function useCodexSelection(): CodexSelection {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("entry");

  const select = useCallback(
    (entryId: string) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("entry", entryId);
      // replace (not push) so the back button leaves the codex screen rather
      // than stepping through every entry the user clicked.
      router.replace(`${pathname}?${next.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const clear = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("entry");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [router, pathname, searchParams]);

  return { selectedId, select, clear };
}
