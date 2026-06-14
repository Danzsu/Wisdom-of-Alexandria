"use client";

/**
 * TanStack Query hooks for the M8 Export screen: resolving the book (for the
 * title + filename) and the Markdown-export mutation that downloads the file.
 *
 * Errors propagate via Query's `error` / `isError` (never swallowed). The
 * browser download is done with a Blob + object URL that is ALWAYS revoked
 * (even on a synchronous failure) so no object URL leaks.
 */
import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { resolveBookById } from "./books";
import { exportBookMarkdown, type MarkdownExport } from "./exports";
import type { BookRead } from "./types";

/** Query keys for the export-related resources. */
export const exportQueryKeys = {
  book: (bookId: string) => ["export", "book", bookId] as const,
};

/**
 * Resolve the `BookRead` for a bare `bookId` (cached). Disabled until an id is
 * present. The Export screen uses the resolved title for the filename preview +
 * the client-side ASCII-fold fallback.
 */
export function useResolvedBook(
  bookId: string | undefined,
): UseQueryResult<BookRead, Error> {
  return useQuery({
    queryKey: exportQueryKeys.book(bookId ?? "__none__"),
    queryFn: () => resolveBookById(bookId as string),
    enabled: Boolean(bookId),
    staleTime: 5 * 60_000,
  });
}

/**
 * Trigger a browser download of a text document via a Blob + object URL. The
 * object URL is created, clicked, then ALWAYS revoked in a `finally` so it is
 * released even if appending/clicking throws — no leaked object URLs.
 *
 * Guarded for SSR (`document` undefined) — a no-op there; the export action is
 * only ever invoked from a client event handler.
 */
export function downloadTextFile(
  content: string,
  filename: string,
  mimeType = "text/markdown;charset=utf-8",
): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Input for the Markdown export mutation. */
export interface ExportMarkdownInput {
  bookId: string;
  /** Book title — used only for the client-side filename fallback. */
  title: string;
}

/**
 * Export a book as Markdown and download it. The mutation fetches the document
 * (real backend endpoint), then triggers the browser download with the resolved
 * filename (server `Content-Disposition` honored; otherwise the ASCII-fold
 * fallback). Returns the {@link MarkdownExport} so callers can assert/inspect.
 * Errors propagate via the mutation's `error` (the page shows an error toast).
 */
export function useExportMarkdown(): UseMutationResult<
  MarkdownExport,
  Error,
  ExportMarkdownInput
> {
  return useMutation({
    mutationFn: async ({ bookId, title }: ExportMarkdownInput) => {
      const result = await exportBookMarkdown(bookId, title);
      downloadTextFile(result.content, result.filename);
      return result;
    },
  });
}
