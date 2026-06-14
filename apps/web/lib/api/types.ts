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

/** Array schemas used by list endpoints. */
export const projectListSchema = z.array(projectReadSchema);
export const bookListSchema = z.array(bookReadSchema);
