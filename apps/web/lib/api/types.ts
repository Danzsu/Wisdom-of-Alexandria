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
 * Book — mirrors app/schemas/book.py
 * ------------------------------------------------------------------------- */

/** A book as returned by the API (`BookRead`). Belongs to a project. */
export const bookReadSchema = z.object({
  id: idString,
  project_id: idString,
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

/** A codex entry as returned by the API (`CodexEntryRead`). */
export const codexEntryReadSchema = z.object({
  id: idString,
  project_id: idString,
  title: z.string(),
  entry_type: z.string(),
  content: z.string().nullable(),
  ai_visible: z.boolean(),
  tags: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CodexEntryRead = z.infer<typeof codexEntryReadSchema>;

/**
 * Request body for creating a codex entry (`CodexEntryCreate`).
 *
 * Mirrors `apps/api/app/schemas/codex_entry.py` EXACTLY — the backend Codex is a
 * generic card: `title` (the entry NAME), `entry_type` (Character/Location/…),
 * `content` (the DESCRIPTION), `ai_visible` (spoiler-protection toggle) and a
 * single `tags` list. There are no dedicated `aliases` / `role` columns, so the
 * frontend folds aliases + role into `tags` via a documented codec (see
 * `lib/api/codex.ts`). `entry_type` defaults to "custom" server-side.
 */
export const codexEntryCreateSchema = z.object({
  title: z.string().min(1).max(255),
  entry_type: z.string().max(100).default("custom"),
  content: z.string().nullable().optional(),
  ai_visible: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});
export type CodexEntryCreate = z.infer<typeof codexEntryCreateSchema>;

/** Request body for patching a codex entry (`CodexEntryUpdate`). All optional. */
export const codexEntryUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  entry_type: z.string().max(100).optional(),
  content: z.string().nullable().optional(),
  ai_visible: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
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
