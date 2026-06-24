/**
 * Centralized route builders for the app shell.
 *
 * The prototype's `state.view` switcher is replaced by real Next.js App Router
 * segments with Hungarian slugs. Keeping the slugs here means the shell, the
 * command palette and the rail all agree on a single source of truth.
 *
 * `bookId` is a runtime value; M2 uses a placeholder ("demo") for navigation
 * verification — real data fetching arrives in M3.
 */

/** The book route segments (children of `konyv/[bookId]`). */
export const BOOK_SEGMENTS = [
  "terv",
  "iras",
  "codex",
  "chat",
  "attekintes",
  "idosor",
  "kapcsolatok",
  "cselekmenyszalak",
  "feladatok",
  "promptok",
  "hangok",
  "export",
  "beallitasok",
] as const;

export type BookSegment = (typeof BOOK_SEGMENTS)[number];

/** Placeholder book id used for navigation while data fetching is stubbed. */
export const DEMO_BOOK_ID = "demo";

/** Placeholder scene id used for the Write route while data fetching is stubbed. */
export const DEMO_SCENE_ID = "demo";

export const routes = {
  /** Project picker (outside any book). */
  projects: () => "/projekt",
  /** Author profile (user-level, outside any book). */
  profile: () => "/profil",
  /** Book-scoped destination by segment. */
  book: (bookId: string, segment: BookSegment) => `/konyv/${bookId}/${segment}`,
  /** Write view for a specific scene. */
  scene: (bookId: string, sceneId: string) =>
    `/konyv/${bookId}/iras/${sceneId}`,
} as const;
