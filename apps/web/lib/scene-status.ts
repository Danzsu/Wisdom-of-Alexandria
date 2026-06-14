/**
 * Scene status → presentation mapping.
 *
 * The backend `Scene.status` enum (`apps/api/app/models/scene.py`) has four
 * values: `draft`, `in_progress`, `complete`, `archived`. The Plan Board
 * prototype shows four status pills/columns — Tervezett / Piszkozat / Elkészült
 * / Végleges — with the dot colours below. We map the real enum onto those
 * verbatim Hungarian labels + the prototype's dot tokens:
 *
 *   draft        → "tervezett"  · text-faint dot   (Matrix col "Tervezett")
 *   in_progress  → "piszkozat"  · accent dot       (Matrix col "Piszkozat")
 *   complete     → "elkészült"  · pov3 dot         (Matrix col "Elkészült")
 *   archived     → "archiválva" · success dot      (Matrix col "Végleges")
 *
 * The prototype's fourth column is "Végleges" (final). The backend has no
 * separate "final" state, so `archived` (its only remaining enum value) is
 * surfaced as the fourth column's tone — archived scenes are excluded from the
 * default list anyway, so this only matters if a caller opts into archived.
 * Any unknown status string degrades to the "draft / tervezett" tone rather than
 * throwing, so a future backend value never blanks the board.
 */

/** The backend scene status enum values (mirrors models/scene.py SceneStatus). */
export const SCENE_STATUSES = [
  "draft",
  "in_progress",
  "complete",
  "archived",
] as const;

export type SceneStatus = (typeof SCENE_STATUSES)[number];

/** A status's presentation: verbatim Hungarian label + dot colour token class. */
export interface SceneStatusPresentation {
  /** Verbatim Hungarian label from the prototype. */
  label: string;
  /** Tailwind background class for the 7px status dot (a design token, not hex). */
  dotClass: string;
  /** The Matrix-view column this status falls under (0..3). */
  matrixColumn: 0 | 1 | 2 | 3;
}

const STATUS_MAP: Record<SceneStatus, SceneStatusPresentation> = {
  draft: { label: "tervezett", dotClass: "bg-text-faint", matrixColumn: 0 },
  in_progress: { label: "piszkozat", dotClass: "bg-accent", matrixColumn: 1 },
  complete: { label: "elkészült", dotClass: "bg-pov3-tx", matrixColumn: 2 },
  archived: { label: "archiválva", dotClass: "bg-success", matrixColumn: 3 },
};

const FALLBACK = STATUS_MAP.draft;

/** Resolve a (possibly unknown) status string to its presentation. */
export function sceneStatusPresentation(
  status: string,
): SceneStatusPresentation {
  return STATUS_MAP[status as SceneStatus] ?? FALLBACK;
}

/** The four Matrix columns, in order, with their header label + dot token. */
export const MATRIX_COLUMNS: { label: string; dotClass: string }[] = [
  { label: "Tervezett", dotClass: "bg-text-faint" },
  { label: "Piszkozat", dotClass: "bg-accent" },
  { label: "Elkészült", dotClass: "bg-pov3-tx" },
  { label: "Végleges", dotClass: "bg-success" },
];
