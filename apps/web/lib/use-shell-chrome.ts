"use client";

import { usePathname } from "next/navigation";
import type { BookSegment } from "./routes";

/** Which left sidebar the body row mounts for the active route. */
export type LeftSidebar = "rail" | "tree" | "codex";

export interface ShellChrome {
  /** True when inside a book (`/konyv/...`); false on the project picker. */
  inBook: boolean;
  /** The active book id (from the route), or null outside a book. */
  bookId: string | null;
  /** The active book segment, or null outside a book. */
  segment: BookSegment | null;
  /** Which left sidebar to render. Outside a book there is no sidebar. */
  leftSidebar: LeftSidebar | null;
  /** True only on the Write route — drives StatusBar + AI inspector slot. */
  isWrite: boolean;
  /** Whether the icon rail is shown at all (only inside a book). */
  showRail: boolean;
}

/**
 * Parse the active book segment out of a pathname.
 * `/konyv/<bookId>/<segment>/...` → `<segment>`; anything else → null.
 */
export function segmentFromPathname(pathname: string): BookSegment | null {
  const parts = pathname.split("/").filter(Boolean);
  // ["konyv", bookId, segment, ...]
  if (parts[0] !== "konyv" || parts.length < 3) return null;
  return parts[2] as BookSegment;
}

/**
 * Parse the active book id out of a pathname.
 * `/konyv/<bookId>/...` → `<bookId>`; anything else → null. Sibling to
 * {@link segmentFromPathname} so the shell can thread the REAL book id (rather
 * than a placeholder) into the rail / top bar.
 */
export function bookIdFromPathname(pathname: string): string | null {
  const parts = pathname.split("/").filter(Boolean);
  // ["konyv", bookId, ...]
  if (parts[0] !== "konyv" || parts.length < 2) return null;
  return parts[1];
}

/**
 * Derive the persistent-shell chrome (which sidebar, whether StatusBar shows,
 * etc.) purely from the current pathname. All shell components share this so
 * the chrome stays consistent across the tree.
 */
export function deriveChrome(pathname: string): ShellChrome {
  const inBook = pathname.startsWith("/konyv/");
  const bookId = bookIdFromPathname(pathname);
  const segment = segmentFromPathname(pathname);
  const isWrite = segment === "iras";
  const isCodex = segment === "codex";

  const leftSidebar: LeftSidebar | null = !inBook
    ? null
    : isWrite
      ? "tree"
      : isCodex
        ? "codex"
        : "rail";

  return {
    inBook,
    bookId,
    segment,
    leftSidebar,
    isWrite,
    showRail: inBook,
  };
}

/** Hook form of {@link deriveChrome}, reading the live pathname. */
export function useShellChrome(): ShellChrome {
  const pathname = usePathname();
  return deriveChrome(pathname ?? "/");
}
