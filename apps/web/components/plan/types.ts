/**
 * Plan Board view-model types. These are the presentation shapes the board
 * components render — derived from the real chapter/scene API data by
 * `use-plan-board.ts`, with status labels + POV badges resolved. Keeping them
 * separate from the API types means the components never reach into raw schema
 * shapes (business/data logic lives in the hook, per the M7 rules).
 */
import type { ChapterWithScenes } from "@/lib/api/hooks";
import type { SceneRead } from "@/lib/api/types";

/** Plan Board view modes (the Rács / Mátrix / Vázlat toggle). */
export type PlanView = "grid" | "matrix" | "outline";

/** Card density (the default / compact / slim toggle). */
export type PlanDensity = "default" | "compact" | "slim";

/** A resolved POV badge: a character name (or id fallback) + its pov slot. */
export interface PovBadge {
  /** The character's display name, or the raw id when unresolved. */
  label: string;
  /** 1-based POV slot (pov1..pov6) driving the badge colour token. */
  slot: number;
}

/** A scene as rendered on the board (status + POV resolved). */
export interface PlanScene {
  id: string;
  chapterId: string;
  /** 1-based position within its chapter (drives "N. jelenet"). */
  index: number;
  /** The scene's own title, or "N. jelenet" when blank. */
  title: string;
  summary: string | null;
  status: string;
  pov: PovBadge[];
  /** The raw scene (for actions that need the full record). */
  raw: SceneRead;
}

/** A chapter (column) as rendered on the board. */
export interface PlanChapter {
  id: string;
  bookId: string;
  /** 1-based position within the book. */
  index: number;
  title: string;
  scenes: PlanScene[];
  /** The raw chapter (for actions). */
  raw: ChapterWithScenes;
}
