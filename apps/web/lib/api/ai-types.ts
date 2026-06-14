/**
 * Frontend contract types + Zod schemas for the AI generation, Revision, Snippet
 * and Model-listing endpoints. These mirror the backend Pydantic schemas exactly
 * so a contract drift surfaces as a thrown Zod error rather than a silent shape
 * mismatch (same discipline as `lib/api/types.ts`).
 *
 * Source of truth:
 * - `apps/api/app/api/v1/ai.py`            (request bodies + AIResult / AIDescribeResult / ModelsResponse)
 * - `apps/api/app/schemas/revision.py`     (RevisionRead)
 * - `apps/api/app/schemas/generation_job.py` (GenerationJobRead)
 * - `apps/api/app/schemas/snippet.py`      (SnippetCreate / SnippetRead)
 */
import { z } from "zod";

const idString = z.string().min(1);

/* ---------------------------------------------------------------------------
 * Revision — mirrors app/schemas/revision.py (RevisionRead).
 *
 * The human-in-the-loop contract: every AI generation is persisted as a
 * Revision (`approved: false` until the user accepts). The AI never overwrites
 * the manuscript; the editor only inserts after an explicit accept.
 * ------------------------------------------------------------------------- */
export const revisionReadSchema = z.object({
  id: idString,
  scene_id: idString.nullable(),
  job_id: idString.nullable(),
  content: z.string(),
  approved: z.boolean(),
  revision_type: z.string(),
  model_name: z.string().nullable(),
  prompt_version: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type RevisionRead = z.infer<typeof revisionReadSchema>;

/* ---------------------------------------------------------------------------
 * GenerationJob — mirrors app/schemas/generation_job.py (GenerationJobRead).
 * ------------------------------------------------------------------------- */
export const generationJobReadSchema = z.object({
  id: idString,
  scene_id: idString.nullable(),
  chapter_id: idString.nullable(),
  job_type: z.string(),
  status: z.string(),
  model_name: z.string().nullable(),
  prompt_version: z.string().nullable(),
  input_data: z.record(z.string(), z.unknown()).nullable(),
  output_data: z.record(z.string(), z.unknown()).nullable(),
  error_message: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type GenerationJobRead = z.infer<typeof generationJobReadSchema>;

/* ---------------------------------------------------------------------------
 * AI results — mirror app/api/v1/ai.py (AIResult / AIDescribeResult).
 * ------------------------------------------------------------------------- */

/** Single-revision result (rewrite / generate-scene / write-continue / summarize). */
export const aiResultSchema = z.object({
  revision: revisionReadSchema,
  job: generationJobReadSchema,
});
export type AIResult = z.infer<typeof aiResultSchema>;

/** Multi-revision result (describe — one revision per requested channel). */
export const aiDescribeResultSchema = z.object({
  revisions: z.array(revisionReadSchema),
  job: generationJobReadSchema,
});
export type AIDescribeResult = z.infer<typeof aiDescribeResultSchema>;

/* ---------------------------------------------------------------------------
 * Snippet — mirrors app/schemas/snippet.py (SnippetCreate / SnippetRead).
 * Snippets are project-scoped (`/projects/{project_id}/snippets`).
 * ------------------------------------------------------------------------- */
export const snippetReadSchema = z.object({
  id: idString,
  project_id: idString,
  title: z.string(),
  content: z.string(),
  source_scene_id: idString.nullable(),
  tags: z.array(z.string()),
  created_at: z.string(),
  updated_at: z.string(),
});
export type SnippetRead = z.infer<typeof snippetReadSchema>;

export const snippetCreateSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1),
  source_scene_id: idString.nullable().optional(),
  tags: z.array(z.string()).default([]),
});
export type SnippetCreate = z.infer<typeof snippetCreateSchema>;

/* ---------------------------------------------------------------------------
 * Models — mirrors app/api/v1/ai.py (ModelsResponse). The UI renders whatever
 * the backend/ModelRouter config exposes; model names are NEVER hardcoded here.
 * ------------------------------------------------------------------------- */
export const modelInfoSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
  kind: z.enum(["local", "cloud"]),
  moderated: z.boolean().default(false),
});
export type ModelInfo = z.infer<typeof modelInfoSchema>;

export const modelsResponseSchema = z.object({
  models: z.array(modelInfoSchema),
  default: z.string(),
});
export type ModelsResponse = z.infer<typeof modelsResponseSchema>;

/* ---------------------------------------------------------------------------
 * Request bodies — mirror app/api/v1/ai.py request schemas. The model is always
 * supplied from the ModelSelector (config-driven); never a literal in the UI.
 * ------------------------------------------------------------------------- */
export interface RewriteRequest {
  selected_text: string;
  instruction: string;
  scene_id?: string | null;
  model?: string | null;
}

export interface DescribeRequest {
  selected_text: string;
  channels?: string[] | null;
  scene_id?: string | null;
  model?: string | null;
}

export interface GenerateSceneRequest {
  beats: string[];
  characters?: string;
  location?: string;
  style_notes?: string;
  scene_id?: string | null;
  model?: string | null;
}

export interface WriteContinueRequest {
  scene_text: string;
  context?: string;
  word_count_target?: number;
  scene_id?: string | null;
  model?: string | null;
}

/**
 * The six sensory Describe channels, verbatim from the backend
 * (`AIService.DESCRIBE_CHANNELS`). The prototype labels the last one "Metafora";
 * the backend channel id is "Metaforák" — we keep the id exact and label
 * separately in the UI.
 */
export const DESCRIBE_CHANNELS = [
  "Látás",
  "Hang",
  "Tapintás",
  "Szag",
  "Íz",
  "Metaforák",
] as const;
export type DescribeChannel = (typeof DESCRIBE_CHANNELS)[number];
