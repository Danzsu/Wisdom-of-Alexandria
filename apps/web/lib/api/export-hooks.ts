"use client";

/**
 * TanStack Query hooks for the M8 Export screen: resolving the book (for the
 * title + filename) and the export mutation that downloads the file (Markdown
 * native; DOCX/EPUB converted server-side via pandoc).
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
import {
  exportBook,
  type ExportFormatId,
  type ExportResult,
  type ExportScope,
} from "./exports";
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
 * Trigger a browser download of a Blob via an object URL. The object URL is
 * created, clicked, then ALWAYS revoked in a `finally` so it is released even if
 * appending/clicking throws — no leaked object URLs. Works for text (Markdown)
 * and binary (DOCX/EPUB) blobs alike.
 *
 * Guarded for SSR (`document` undefined) — a no-op there; the export action is
 * only ever invoked from a client event handler.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof document === "undefined") return;
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

/** Input for the export mutation. */
export interface ExportInput {
  bookId: string;
  /**
   * Scope-appropriate title (book / chapter / scene) — used only for the
   * client-side filename fallback when the server omits a Content-Disposition.
   */
  title: string;
  /** Export tartomány. Defaults to whole-book. */
  scope?: ExportScope;
  /** Output format (md / docx / epub). Defaults to Markdown. */
  format?: ExportFormatId;
  /** Chapter / scene id — REQUIRED (and only used) when scope ≠ book. */
  targetId?: string;
}

/**
 * Export a book / chapter / scene in the chosen format and download it. The
 * mutation fetches the document (real backend endpoint, scope + format +
 * target_id forwarded), then triggers the browser download with the resolved
 * filename (server `Content-Disposition` honored; otherwise the ASCII-fold
 * fallback with the format extension). Returns the {@link ExportResult} so
 * callers can assert/inspect. Errors propagate via the mutation's `error` (the
 * page shows an error toast) — pandoc-missing (503) / conversion-failure (502)
 * surface their actionable `detail` message.
 */
export function useExportDocument(): UseMutationResult<
  ExportResult,
  Error,
  ExportInput
> {
  return useMutation({
    mutationFn: async ({
      bookId,
      title,
      scope,
      format,
      targetId,
    }: ExportInput) => {
      const result = await exportBook(bookId, title, { scope, format, targetId });
      downloadBlob(result.blob, result.filename);
      return result;
    },
  });
}
