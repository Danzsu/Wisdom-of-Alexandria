/**
 * Frontend contract types + Zod schemas for Project and Book, mirroring the
 * backend Pydantic schemas exactly.
 *
 * Source of truth:
 * - `apps/api/app/schemas/project.py` (ProjectCreate / ProjectRead)
 * - `apps/api/app/schemas/book.py` (BookCreate / BookRead)
 *
 * Pragmatic placement: contract types live here in `apps/web` for now; promotion
 * to `packages/shared` is a later cleanup (per the M3 spec).
 */
import { z } from "zod";

/* ---------------------------------------------------------------------------
 * Project — mirrors app/schemas/project.py
 * ------------------------------------------------------------------------- */

/**
 * UUID-bearing id field. The backend types these as `uuid.UUID`, but we only
 * validate "non-empty string" here: strict RFC-4122 version/variant checks would
 * reject valid server ids and are an unnecessary frontend over-reach.
 */
const idString = z.string().min(1);

/** A project as returned by the API (`ProjectRead`). */
export const projectReadSchema = z.object({
  id: idString,
  title: z.string(),
  description: z.string().nullable(),
  language: z.string(),
  created_at: z.string(), // ISO-8601 datetime
  updated_at: z.string(),
  // Card aggregates (Feature #1): number of books and total words across the
  // whole project (sum of Scene.word_count). Computed server-side on read paths.
  book_count: z.number().int(),
  word_count: z.number().int(),
});
export type ProjectRead = z.infer<typeof projectReadSchema>;

/** Request body for creating a project (`ProjectCreate`). */
export const projectCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  language: z.string().max(10).default("hu"),
});
export type ProjectCreate = z.infer<typeof projectCreateSchema>;

/* ---------------------------------------------------------------------------
 * Series — mirrors app/schemas/series.py (Feature #3a). A Series groups books
 * within a project; Codex entries can be series-scoped (see `series_id` below).
 * ------------------------------------------------------------------------- */

/** A series as returned by the API (`SeriesRead`). Belongs to a project. */
export const seriesReadSchema = z.object({
  id: idString,
  project_id: idString,
  title: z.string(),
  description: z.string().nullable(),
  order_index: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type SeriesRead = z.infer<typeof seriesReadSchema>;

/**
 * Request body for creating a series under a project (`SeriesCreate`).
 * `order_index` is optional (the backend defaults it server-side), so the
 * inferred input type stays `{title, description?, order_index?}`.
 */
export const seriesCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  order_index: z.number().int().optional(),
});
export type SeriesCreate = z.infer<typeof seriesCreateSchema>;

/** Request body for patching a series (`SeriesUpdate`). All fields optional. */
export const seriesUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  order_index: z.number().int().optional(),
});
export type SeriesUpdate = z.infer<typeof seriesUpdateSchema>;

export const seriesListSchema = z.array(seriesReadSchema);

/* ---------------------------------------------------------------------------
 * Book — mirrors app/schemas/book.py
 * ------------------------------------------------------------------------- */

/**
 * A book as returned by the API (`BookRead`). Belongs to a project, and since
 * Feature #3a may optionally belong to a `Series` within that project
 * (`series_id`: the series id, or `null` for an unassigned book).
 */
export const bookReadSchema = z.object({
  id: idString,
  project_id: idString,
  series_id: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  synopsis: z.string().nullable(),
  genre: z.string().nullable(),
  language: z.string(),
  word_count_target: z.number().int().nullable(),
  order_index: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type BookRead = z.infer<typeof bookReadSchema>;

/**
 * Request body for patching a book (`BookUpdate`). All fields optional. The
 * frontend only sends what it changes; `series_id` assigns the book to a series
 * (a series id) or clears it (`null`). The backend rejects a cross-project
 * series with a 400 (surfaced as an `ApiError`, never swallowed).
 */
export const bookUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  synopsis: z.string().nullable().optional(),
  genre: z.string().max(100).nullable().optional(),
  language: z.string().max(10).optional(),
  word_count_target: z.number().int().nullable().optional(),
  order_index: z.number().int().optional(),
  series_id: z.string().nullable().optional(),
});
export type BookUpdate = z.infer<typeof bookUpdateSchema>;

/** Request body for creating a book under a project (`BookCreate`). */
export const bookCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  synopsis: z.string().nullable().optional(),
  genre: z.string().max(100).nullable().optional(),
  language: z.string().max(10).default("hu"),
  word_count_target: z.number().int().nullable().optional(),
  order_index: z.number().int().default(0),
});
export type BookCreate = z.infer<typeof bookCreateSchema>;

/* ---------------------------------------------------------------------------
 * Chapter — mirrors app/schemas/chapter.py
 * ------------------------------------------------------------------------- */

/** A chapter as returned by the API (`ChapterRead`). Belongs to a book. */
export const chapterReadSchema = z.object({
  id: idString,
  book_id: idString,
  title: z.string(),
  summary: z.string().nullable(),
  order_index: z.number().int(),
  status: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ChapterRead = z.infer<typeof chapterReadSchema>;

/**
 * Request body for creating a chapter under a book (`ChapterCreate`). Mirrors
 * `apps/api/app/schemas/chapter.py`: `order_index` defaults to 0 server-side and
 * `status` to "draft".
 */
export const chapterCreateSchema = z.object({
  title: z.string().min(1).max(255),
  summary: z.string().nullable().optional(),
  order_index: z.number().int().default(0),
  status: z.string().default("draft"),
});
export type ChapterCreate = z.infer<typeof chapterCreateSchema>;

/** Request body for patching a chapter (`ChapterUpdate`). All fields optional. */
export const chapterUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  summary: z.string().nullable().optional(),
  order_index: z.number().int().optional(),
  status: z.string().optional(),
});
export type ChapterUpdate = z.infer<typeof chapterUpdateSchema>;

/**
 * Reorder body for chapters (`ChapterReorder`). The backend assigns
 * `order_index = position-in-list` for every id present, then returns the
 * re-sorted list. Ids not in the book are ignored server-side.
 */
export const chapterReorderSchema = z.object({
  order: z.array(idString),
});
export type ChapterReorder = z.infer<typeof chapterReorderSchema>;

/* ---------------------------------------------------------------------------
 * Scene — mirrors app/schemas/scene.py
 * ------------------------------------------------------------------------- */

/** A scene as returned by the API (`SceneRead`). Belongs to a chapter. */
export const sceneReadSchema = z.object({
  id: idString,
  chapter_id: idString,
  title: z.string(),
  content: z.string().nullable(),
  summary: z.string().nullable(),
  order_index: z.number().int(),
  status: z.string(),
  word_count: z.number().int(),
  pov_character_id: idString.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type SceneRead = z.infer<typeof sceneReadSchema>;

/**
 * Request body for creating a scene under a chapter (`SceneCreate`). Mirrors
 * `apps/api/app/schemas/scene.py`: `word_count` is computed server-side from
 * `content`, so the client never sends it; `order_index` defaults to 0 and
 * `status` to "draft" server-side.
 */
export const sceneCreateSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  order_index: z.number().int().default(0),
  status: z.string().default("draft"),
  pov_character_id: idString.nullable().optional(),
});
export type SceneCreate = z.infer<typeof sceneCreateSchema>;

/**
 * Reorder body for scenes within a chapter (`SceneReorder`). The backend sets
 * `order_index = position-in-list` for each id, then returns the re-sorted
 * (non-archived) list. NOTE: this reorders WITHIN a single chapter — the backend
 * has no cross-chapter move (SceneUpdate carries no `chapter_id`), so scene drag
 * is constrained to its own chapter (see lib/api/hooks.ts useReorderScenes).
 */
export const sceneReorderSchema = z.object({
  order: z.array(idString),
});
export type SceneReorder = z.infer<typeof sceneReorderSchema>;

/**
 * Cross-chapter move body for a scene (`SceneMove`, P1.5). Mirrors
 * `apps/api/app/schemas/scene.py`: `chapter_id` is the DESTINATION chapter (must
 * belong to the same book as the scene's current chapter — enforced server-side)
 * and `order_index` is the 0-based insertion slot in the target chapter (clamped
 * to its bounds server-side). The backend renumbers `order_index` densely in
 * BOTH the source and target chapters and returns the moved scene.
 */
export const sceneMoveSchema = z.object({
  chapter_id: idString,
  order_index: z.number().int().min(0),
});
export type SceneMove = z.infer<typeof sceneMoveSchema>;

/**
 * Request body for patching a scene (`SceneUpdate`). All fields optional; the
 * backend recomputes `word_count` server-side whenever `content` is present, so
 * the frontend never sends it.
 */
export const sceneUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  content: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  order_index: z.number().int().optional(),
  status: z.string().optional(),
  pov_character_id: idString.nullable().optional(),
});
export type SceneUpdate = z.infer<typeof sceneUpdateSchema>;

/* ---------------------------------------------------------------------------
 * Codex entry — mirrors app/schemas/codex_entry.py (read-only here for M4's
 * CodexMention popover; full CRUD is M6 and is project-scoped).
 * ------------------------------------------------------------------------- */

/**
 * A codex entry as returned by the API (`CodexEntryRead`).
 *
 * Since P1.4 the backend carries dedicated `aliases` (recognition names) + `role`
 * (story role) columns, mirroring `Character` (`app/schemas/codex_entry.py`).
 * `tags` is now plain user labels only — the old `__woa:` tags codec is gone.
 */
export const codexEntryReadSchema = z.object({
  id: idString,
  project_id: idString,
  // Feature #3a — a codex entry is project-global (`null`) or scoped to a
  // specific series within the project (the series id).
  series_id: z.string().nullable(),
  title: z.string(),
  entry_type: z.string(),
  content: z.string().nullable(),
  aliases: z.array(z.string()),
  role: z.string().nullable(),
  ai_visible: z.boolean(),
  tags: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CodexEntryRead = z.infer<typeof codexEntryReadSchema>;

/**
 * Request body for creating a codex entry (`CodexEntryCreate`).
 *
 * Mirrors `apps/api/app/schemas/codex_entry.py` EXACTLY — the backend Codex card
 * carries `title` (the entry NAME), `entry_type` (Character/Location/…),
 * `content` (the DESCRIPTION), `aliases` (recognition names), `role` (the single
 * story role), `ai_visible` (spoiler-protection toggle) and a `tags` list of
 * plain user labels. `entry_type` defaults to "custom" server-side; `aliases`
 * defaults to `[]` and `role` to `null`.
 */
export const codexEntryCreateSchema = z.object({
  title: z.string().min(1).max(255),
  entry_type: z.string().max(100).default("custom"),
  content: z.string().nullable().optional(),
  aliases: z.array(z.string()).default([]),
  role: z.string().max(100).nullable().optional(),
  ai_visible: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  // Feature #3a — scope: a series id, or `null`/omitted for project-global.
  series_id: z.string().nullable().optional(),
});
export type CodexEntryCreate = z.infer<typeof codexEntryCreateSchema>;

/** Request body for patching a codex entry (`CodexEntryUpdate`). All optional. */
export const codexEntryUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  entry_type: z.string().max(100).optional(),
  content: z.string().nullable().optional(),
  aliases: z.array(z.string()).optional(),
  role: z.string().max(100).nullable().optional(),
  ai_visible: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  // Feature #3a — re-scope an entry: a series id, or `null` for project-global.
  series_id: z.string().nullable().optional(),
});
export type CodexEntryUpdate = z.infer<typeof codexEntryUpdateSchema>;

/* ---------------------------------------------------------------------------
 * Beat — mirrors app/schemas/beat.py (BeatRead / BeatCreate). Scene-scoped.
 * ------------------------------------------------------------------------- */

/** A scene beat as returned by the API (`BeatRead`). */
export const beatReadSchema = z.object({
  id: idString,
  scene_id: idString,
  description: z.string(),
  beat_type: z.string().nullable(),
  order_index: z.number().int(),
  notes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type BeatRead = z.infer<typeof beatReadSchema>;

/** Request body for creating a beat under a scene (`BeatCreate`). */
export const beatCreateSchema = z.object({
  description: z.string().min(1),
  beat_type: z.string().max(100).nullable().optional(),
  order_index: z.number().int().default(0),
  notes: z.string().nullable().optional(),
});
export type BeatCreate = z.infer<typeof beatCreateSchema>;

export const beatListSchema = z.array(beatReadSchema);

/** Array schemas used by list endpoints. */
export const projectListSchema = z.array(projectReadSchema);
export const bookListSchema = z.array(bookReadSchema);
export const chapterListSchema = z.array(chapterReadSchema);
export const sceneListSchema = z.array(sceneReadSchema);
export const codexEntryListSchema = z.array(codexEntryReadSchema);
