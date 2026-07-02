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
import type {
  AIContextEntity as GenAIContextEntity,
  AIDescribeResult as GenAIDescribeResult,
  AIResult as GenAIResult,
  BrainstormResult as GenBrainstormResult,
  ContinuityResult as GenContinuityResult,
  ContinuityWarning as GenContinuityWarning,
  Expect,
  GenerationJobRead as GenGenerationJobRead,
  MatchesContract,
  ModelInfo as GenModelInfo,
  ModelsResponse as GenModelsResponse,
  ResearchResult as GenResearchResult,
  RevisionRead as GenRevisionRead,
  SnippetRead as GenSnippetRead,
} from "@alexandria/shared";
import { idString } from "./schema-primitives";

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
 *
 * `status` and `job_type` are kept as plain `z.string()` on the wire (the
 * backend columns are free strings, not DB enums), so a value the UI does not
 * recognise still parses and renders with a graceful fallback rather than
 * throwing. {@link JOB_STATUSES} / {@link JOB_TYPES} below enumerate the values
 * the AI service actually writes today, for the badge variant + label maps.
 * ------------------------------------------------------------------------- */
export const generationJobReadSchema = z.object({
  id: idString,
  // Set for project-level jobs (the async RAG index rebuild); null for the
  // scene/chapter-scoped generation jobs.
  project_id: idString.nullable(),
  scene_id: idString.nullable(),
  chapter_id: idString.nullable(),
  // Set for book-level jobs (`book_generate`) — drives the book-scoped jobs
  // listing + the context line. `.default(null)` so a response from an older
  // AI service (before the column existed) still parses (same tolerance
  // discipline as `context_entities` below).
  book_id: idString.nullable().default(null),
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

/**
 * The job statuses the AI service writes, verbatim from the backend `JobStatus`
 * class (`alexandria_core/models/generation_job.py`): pending / running / done
 * / failed / cancelled. `failed` is the attention status that drives the nav
 * warning badge; `cancelled` is the user-requested stop (POST /jobs/{id}/cancel).
 * An unknown status (e.g. legacy data) is rendered with a neutral fallback —
 * the union is for the colour/label maps, NOT a parse gate.
 */
export const JOB_STATUSES = [
  "pending",
  "running",
  "done",
  "failed",
  "cancelled",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** Narrow an arbitrary status string to a known {@link JobStatus}, or null. */
export function asJobStatus(value: string): JobStatus | null {
  return (JOB_STATUSES as readonly string[]).includes(value)
    ? (value as JobStatus)
    : null;
}

/**
 * The job types the AI service writes today (one per AI action that persists a
 * GenerationJob — see `apps/ai/app/api/v1/ai.py`). Used for the localized
 * job-type label; an unknown type falls back to the raw string in the UI.
 */
export const JOB_TYPES = [
  "rewrite",
  "describe",
  "generate_scene",
  "write_continue",
  "summarize",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

/* ---------------------------------------------------------------------------
 * AI results — mirror app/api/v1/ai.py (AIResult / AIDescribeResult).
 * ------------------------------------------------------------------------- */

/**
 * A Codex/manuscript entry RAG retrieved and injected into the generation
 * context — mirrors the backend `ContextEntity` (app/api/v1/ai.py). The UI
 * renders these as ContextChips ("grounded on: …"). `entity_type` stays a plain
 * `z.string()` (codex / character / location / worldbuilding / scene / chapter /
 * styleguide today): an unrecognised type still parses and falls back to a
 * default icon rather than throwing — same discipline as the job-status string.
 */
export const aiContextEntitySchema = z.object({
  id: idString,
  label: z.string(),
  entity_type: z.string(),
});
export type AIContextEntity = z.infer<typeof aiContextEntitySchema>;

/**
 * Retrieved RAG context attached to every AI result. `.default([])` so a
 * response WITHOUT the field (an older AI service, or the common local case
 * where RAG is skipped and the backend sends `[]`) still parses — a missing
 * field degrades to "no context chips", never a parse error.
 */
const contextEntitiesField = z.array(aiContextEntitySchema).default([]);

/** Single-revision result (rewrite / generate-scene / write-continue / summarize). */
export const aiResultSchema = z.object({
  revision: revisionReadSchema,
  job: generationJobReadSchema,
  context_entities: contextEntitiesField,
});
export type AIResult = z.infer<typeof aiResultSchema>;

/** Multi-revision result (describe — one revision per requested channel). */
export const aiDescribeResultSchema = z.object({
  revisions: z.array(revisionReadSchema),
  job: generationJobReadSchema,
  context_entities: contextEntitiesField,
});
export type AIDescribeResult = z.infer<typeof aiDescribeResultSchema>;

/* ---------------------------------------------------------------------------
 * Continuity check (B3) — mirrors app/api/v1/ai.py (ContinuityResult /
 * ContinuityWarning). A continuity check is ANALYSIS, not generated content:
 * the result carries no revision — only a list of structured warnings + the
 * RAG context the check was grounded on.
 * ------------------------------------------------------------------------- */

/**
 * The three continuity severities the backend writes. Kept here for the
 * colour/icon/label maps in the UI; the wire schema below stays a tolerant
 * `z.string()` so a future/unknown severity still parses and falls back to a
 * neutral rendering rather than throwing (same discipline as the job status).
 */
export const CONTINUITY_SEVERITIES = ["info", "warning", "error"] as const;
export type ContinuitySeverity = (typeof CONTINUITY_SEVERITIES)[number];

/** Narrow an arbitrary severity string to a known one, or null (UI fallback). */
export function asContinuitySeverity(value: string): ContinuitySeverity | null {
  return (CONTINUITY_SEVERITIES as readonly string[]).includes(value)
    ? (value as ContinuitySeverity)
    : null;
}

/**
 * One structured continuity finding. `severity` is tolerant (`z.string()`) so
 * an unrecognised value still parses; `entity` is the affected Codex entity
 * name or null. Mirrors the backend `ContinuityWarning`.
 */
export const continuityWarningSchema = z.object({
  severity: z.string(),
  message: z.string(),
  entity: z.string().nullable().default(null),
});
export type ContinuityWarning = z.infer<typeof continuityWarningSchema>;

/**
 * Continuity-check result. `warnings: []` is the positive "no issues found"
 * state. `context_entities` reuses the shared RAG-context shape (empty when RAG
 * was skipped / unconfigured — the check then ran on the scene text alone).
 * Both fields `.default([])` so an older/leaner response still parses.
 */
export const continuityResultSchema = z.object({
  warnings: z.array(continuityWarningSchema).default([]),
  context_entities: contextEntitiesField,
});
export type ContinuityResult = z.infer<typeof continuityResultSchema>;

/* ---------------------------------------------------------------------------
 * Research (Codex/manuscript RAG Q&A) — mirrors ai.py ResearchResult.
 *
 * Analysis, NOT generation: the answer is grounded on retrieved Codex/manuscript
 * context; `context_entities` are the citation chips (empty when RAG was skipped
 * / unconfigured — the model then answered from the question alone).
 * ------------------------------------------------------------------------- */
export const researchResultSchema = z.object({
  answer: z.string().default(""),
  context_entities: contextEntitiesField,
});
export type ResearchResult = z.infer<typeof researchResultSchema>;

/* ---------------------------------------------------------------------------
 * Brainstorm (ötletelés) — mirrors apps/ai ai.py BrainstormResult.
 *
 * Ideas, NOT manuscript text: there is NO revision (nothing insertable, nothing
 * to approve). `ideas` is the parsed idea list; `job` is the `brainstorm`
 * GenerationJob provenance record (`null` only for the whitespace-topic
 * short-circuit). `context_entities` reuses the shared RAG-context shape.
 * `ideas` and `job` are tolerant (`.default`) so a lean response still parses.
 * ------------------------------------------------------------------------- */
export const brainstormResultSchema = z.object({
  ideas: z.array(z.string()).default([]),
  job: generationJobReadSchema.nullable().default(null),
  context_entities: contextEntitiesField,
});
export type BrainstormResult = z.infer<typeof brainstormResultSchema>;

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
 *
 * Generation params (`temperature` / `max_tokens`) are OPTIONAL forward-compat
 * fields: the client persists them (M8 Beállítások → Generálás) and attaches
 * them to every generation body in `lib/api/ai.ts`. The v1 AI request schemas
 * do not declare them yet, but FastAPI/Pydantic ignore unknown body fields, so
 * sending them is harmless today and wired the day the backend adds them.
 * ------------------------------------------------------------------------- */

/** Optional client-supplied generation params attached to every AI body. */
export interface GenerationParams {
  temperature?: number;
  max_tokens?: number;
}

export interface RewriteRequest extends GenerationParams {
  selected_text: string;
  instruction: string;
  scene_id?: string | null;
  model?: string | null;
}

export interface DescribeRequest extends GenerationParams {
  selected_text: string;
  channels?: string[] | null;
  scene_id?: string | null;
  model?: string | null;
}

/**
 * Body for `POST /ai/expand` — expand a selection (sensory detail /
 * interiority, voice preserved). HITL like rewrite: the response is a standard
 * `AIResult` with an unapproved `Revision(revision_type="expand")`. `guidance`
 * is the optional user steer (the backend defaults it to "").
 */
export interface ExpandRequest extends GenerationParams {
  selected_text: string;
  guidance?: string;
  scene_id?: string | null;
  model?: string | null;
}

/**
 * Body for `POST /ai/compress` — tighten a selection (cut filler, keep meaning
 * + voice). HITL like rewrite: the response is a standard `AIResult` with an
 * unapproved `Revision(revision_type="compress")`.
 */
export interface CompressRequest extends GenerationParams {
  selected_text: string;
  guidance?: string;
  scene_id?: string | null;
  model?: string | null;
}

/**
 * Body for `POST /ai/brainstorm` (ötletelés). `topic` is required (1–8000
 * chars); `count` is the number of ideas requested (1–10, backend default 5).
 * A `scene_id` opts into scene-scoped RAG grounding. NO revision comes back —
 * see {@link brainstormResultSchema}.
 */
export interface BrainstormRequest extends GenerationParams {
  topic: string;
  count?: number;
  scene_id?: string | null;
  model?: string | null;
}

export interface GenerateSceneRequest extends GenerationParams {
  beats: string[];
  characters?: string;
  location?: string;
  style_notes?: string;
  scene_id?: string | null;
  model?: string | null;
}

export interface WriteContinueRequest extends GenerationParams {
  scene_text: string;
  context?: string;
  word_count_target?: number;
  scene_id?: string | null;
  model?: string | null;
}

/**
 * Body for `POST /ai/chapters/{chapter_id}/generate` (chapter automation, T4).
 * `scene_ids` is the user-selected subset of the chapter's scenes to generate
 * (at least one — the UI disables the Generálás button otherwise);
 * `run_continuity` opts into a per-scene continuity pass on each draft. The
 * generation params (`temperature` / `max_tokens`) are attached client-side like
 * the other AI bodies. Mirrors the backend `ChapterGenerateRequest`.
 */
export interface ChapterGenerateRequest extends GenerationParams {
  scene_ids: string[];
  run_continuity: boolean;
  model?: string | null;
}

/**
 * Body for `POST /ai/books/{book_id}/generate` (book automation, V2).
 * `chapter_ids` is the user-selected subset of the book's chapters (the UI
 * always sends the explicit selection; the backend re-resolves it to story
 * order and treats `null` as "all chapters" — the dialog never relies on
 * that). Per chapter the backend auto-selects the SAFE default: scenes that
 * are EMPTY and have at least one beat. `run_continuity` opts into a per-scene
 * continuity pass. Mirrors the backend `BookGenerateRequest`.
 */
export interface BookGenerateRequest extends GenerationParams {
  chapter_ids: string[];
  run_continuity: boolean;
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

/* ---------------------------------------------------------------------------
 * FE↔BE contract ties (Feature #4). Each schema's inferred shape is bound to
 * the OpenAPI-generated backend type from `@alexandria/shared` (these come from
 * the `apps/ai` OpenAPI, except SnippetRead which lives on `apps/api`). A field
 * add/remove/rename — or an incompatible type drift — on either side fails
 * `tsc`. The FE intentionally narrows some free-string backend fields to unions
 * (`ModelInfo.kind`); the tie tolerates that narrowing (a union is assignable
 * to its widening) while still pinning the key set. Compile-time only; the Zod
 * schemas above stay the runtime validators. (Replaces the fixture drift-guard.)
 * ------------------------------------------------------------------------- */
// One exported tuple binds every AI/Revision/Snippet schema to its generated
// counterpart. `Expect<…>` forces each `MatchesContract` to be `true`; a drift
// flips one element to `false`, violating `extends true` → `tsc` error.
// Exported so it counts as used (no dead-code lint warning).
export type AIContractTies = [
  Expect<MatchesContract<z.infer<typeof revisionReadSchema>, GenRevisionRead>>,
  Expect<
    MatchesContract<
      z.infer<typeof generationJobReadSchema>,
      GenGenerationJobRead
    >
  >,
  Expect<
    MatchesContract<z.infer<typeof aiContextEntitySchema>, GenAIContextEntity>
  >,
  Expect<MatchesContract<z.infer<typeof aiResultSchema>, GenAIResult>>,
  Expect<
    MatchesContract<z.infer<typeof aiDescribeResultSchema>, GenAIDescribeResult>
  >,
  Expect<
    MatchesContract<z.infer<typeof continuityWarningSchema>, GenContinuityWarning>
  >,
  Expect<
    MatchesContract<z.infer<typeof continuityResultSchema>, GenContinuityResult>
  >,
  Expect<
    MatchesContract<z.infer<typeof researchResultSchema>, GenResearchResult>
  >,
  Expect<
    MatchesContract<z.infer<typeof brainstormResultSchema>, GenBrainstormResult>
  >,
  Expect<MatchesContract<z.infer<typeof modelInfoSchema>, GenModelInfo>>,
  Expect<
    MatchesContract<z.infer<typeof modelsResponseSchema>, GenModelsResponse>
  >,
  Expect<MatchesContract<z.infer<typeof snippetReadSchema>, GenSnippetRead>>,
];
