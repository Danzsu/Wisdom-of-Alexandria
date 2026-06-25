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
import { idString } from "./schema-primitives";
import type {
  BeatRead as GenBeatRead,
  BookRead as GenBookRead,
  ChapterRead as GenChapterRead,
  CodexEntryRead as GenCodexEntryRead,
  CodexRelationRead as GenCodexRelationRead,
  Expect,
  MatchesContract,
  MeRead as GenMeRead,
  PlotlineRead as GenPlotlineRead,
  PlotlineSceneRead as GenPlotlineSceneRead,
  ProjectRead as GenProjectRead,
  PromptTemplateRead as GenPromptTemplateRead,
  SceneRead as GenSceneRead,
  SeriesRead as GenSeriesRead,
} from "@alexandria/shared";

/* ---------------------------------------------------------------------------
 * Project — mirrors app/schemas/project.py
 * ------------------------------------------------------------------------- */

/** A project as returned by the API (`ProjectRead`). */
export const projectReadSchema = z.object({
  id: idString,
  title: z.string(),
  description: z.string().nullable(),
  language: z.string(),
  created_at: z.string(), // ISO-8601 datetime
  updated_at: z.string(),
  // Card aggregates (Feature #1): number of books, total words (sum of
  // Scene.word_count) and number of non-archived scenes across the whole
  // project. Computed server-side on read paths.
  book_count: z.number().int(),
  word_count: z.number().int(),
  scene_count: z.number().int(),
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
 * Current user — mirrors app/api/v1/auth.py `MeRead` (GET /auth/me). Single-user
 * .env auth: `username` is the authenticated account; `display_name` + `initials`
 * are derived server-side from the username (no explicit author setting exists).
 * ------------------------------------------------------------------------- */

/** The authenticated user's identity as returned by the API (`MeRead`). */
export const meReadSchema = z.object({
  username: z.string(),
  display_name: z.string(),
  initials: z.string(),
});
export type MeRead = z.infer<typeof meReadSchema>;

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
  author: z.string().nullable(),
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
  author: z.string().max(255).nullable().optional(),
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
  author: z.string().max(255).nullable().optional(),
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
 * PromptTemplate — mirrors app/schemas/prompt_template.py. The user-facing
 * Prompt Library is GLOBAL (workspace-wide, NO project scope):
 *   GET  /prompt-templates            → PromptTemplateRead[] (builtins first)
 *   POST /prompt-templates            → PromptTemplateRead (201, user template)
 *   PATCH/DELETE /prompt-templates/{id} → builtins are 403-protected
 * `body` is the template text with `{token}` placeholders; `is_builtin`/`uses`
 * are server-owned (clients cannot set them on create).
 * ------------------------------------------------------------------------- */

/** A prompt-library template as returned by the API (`PromptTemplateRead`). */
export const promptTemplateReadSchema = z.object({
  id: idString,
  name: z.string(),
  category: z.string(),
  description: z.string(),
  body: z.string(),
  uses: z.number().int(),
  is_builtin: z.boolean(),
  icon_key: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PromptTemplateRead = z.infer<typeof promptTemplateReadSchema>;
export const promptTemplateListSchema = z.array(promptTemplateReadSchema);

/** Request body for creating a USER prompt template (`PromptTemplateCreate`). */
export const promptTemplateCreateSchema = z.object({
  name: z.string().min(1).max(255),
  category: z.string().min(1).max(100),
  description: z.string().max(2000).default(""),
  body: z.string().min(1).max(20000),
  icon_key: z.string().max(50).nullable().optional(),
});
export type PromptTemplateCreate = z.infer<typeof promptTemplateCreateSchema>;

/** Request body for patching a user prompt template (`PromptTemplateUpdate`). */
export const promptTemplateUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  category: z.string().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  body: z.string().min(1).max(20000).optional(),
  icon_key: z.string().max(50).nullable().optional(),
});
export type PromptTemplateUpdate = z.infer<typeof promptTemplateUpdateSchema>;

/* ---------------------------------------------------------------------------
 * CodexRelation — mirrors app/schemas/codex_relation.py (UX-3a relationship
 * graph). PROJECT-scoped (`/projects/{pid}/codex-relations`). A relation is a
 * directed edge between two polymorphic codex entities: `{from_entity_type,
 * from_entity_id}` → `{to_entity_type, to_entity_id}`, labelled by a free
 * `relation_type` (≤100) with an optional `description`. The entity types are
 * plain strings (`character` / `location` / `worldbuilding` / `codex`); the
 * nodes themselves come from the project's codex entries.
 * ------------------------------------------------------------------------- */

/** A codex relation as returned by the API (`CodexRelationRead`). */
export const codexRelationReadSchema = z.object({
  id: idString,
  project_id: idString,
  from_entity_type: z.string(),
  from_entity_id: idString,
  to_entity_type: z.string(),
  to_entity_id: idString,
  relation_type: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type CodexRelationRead = z.infer<typeof codexRelationReadSchema>;

/**
 * Request body for creating a relation (`CodexRelationCreate`). The endpoints
 * are polymorphic over entity type, so both endpoints carry the type + id pair.
 */
export const codexRelationCreateSchema = z.object({
  from_entity_type: z.string().min(1).max(100),
  from_entity_id: idString,
  to_entity_type: z.string().min(1).max(100),
  to_entity_id: idString,
  relation_type: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
});
export type CodexRelationCreate = z.infer<typeof codexRelationCreateSchema>;

/**
 * Request body for patching a relation (`CodexRelationUpdate`). The backend only
 * allows the LABEL to change — the endpoints (`from`/`to`) are immutable, so a
 * re-wire is a delete + create, not a patch.
 */
export const codexRelationUpdateSchema = z.object({
  relation_type: z.string().min(1).max(100).optional(),
  description: z.string().nullable().optional(),
});
export type CodexRelationUpdate = z.infer<typeof codexRelationUpdateSchema>;

export const codexRelationListSchema = z.array(codexRelationReadSchema);

/* ---------------------------------------------------------------------------
 * Plotline — mirrors app/schemas/plotline.py (Plotline-a; Cselekményszálak).
 * PROJECT-scoped (`/projects/{pid}/plotlines`) with an OPTIONAL `book_id` scope
 * (null = project-wide). `plotline_type` + `status` are stored as plain strings
 * server-side (the Pydantic layer validates the allowed sets), so we keep them
 * as `z.string()` in the Read schema and narrow the create/update unions below.
 * Scenes attach via the flat `/plotlines/{id}/scenes` link router; a link is a
 * `PlotlineSceneRead` row (plotline_id + scene_id + order_index).
 * ------------------------------------------------------------------------- */

/** The allowed plotline types (mirrors `PlotlineType`). */
export const PLOTLINE_TYPES = [
  "main_plot",
  "subplot",
  "character_arc",
  "romance",
  "mystery",
  "antagonist_plan",
  "world_conflict",
] as const;
export type PlotlineType = (typeof PLOTLINE_TYPES)[number];

/** The allowed plotline statuses (mirrors `PlotlineStatus`). */
export const PLOTLINE_STATUSES = [
  "planning",
  "active",
  "resolved",
  "abandoned",
] as const;
export type PlotlineStatus = (typeof PLOTLINE_STATUSES)[number];

/** A plotline as returned by the API (`PlotlineRead`). */
export const plotlineReadSchema = z.object({
  id: idString,
  project_id: idString,
  book_id: idString.nullable(),
  title: z.string(),
  description: z.string().nullable(),
  plotline_type: z.string(),
  status: z.string(),
  order_index: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PlotlineRead = z.infer<typeof plotlineReadSchema>;

/** Request body for creating a plotline (`PlotlineCreate`). */
export const plotlineCreateSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().nullable().optional(),
  plotline_type: z.enum(PLOTLINE_TYPES),
  status: z.enum(PLOTLINE_STATUSES).default("planning"),
  book_id: idString.nullable().optional(),
  order_index: z.number().int().default(0),
});
export type PlotlineCreate = z.infer<typeof plotlineCreateSchema>;

/** Request body for patching a plotline (`PlotlineUpdate`). All fields optional. */
export const plotlineUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  plotline_type: z.enum(PLOTLINE_TYPES).optional(),
  status: z.enum(PLOTLINE_STATUSES).optional(),
  book_id: idString.nullable().optional(),
  order_index: z.number().int().optional(),
});
export type PlotlineUpdate = z.infer<typeof plotlineUpdateSchema>;

export const plotlineListSchema = z.array(plotlineReadSchema);

/** A plotline↔scene link as returned by the API (`PlotlineSceneRead`). */
export const plotlineSceneReadSchema = z.object({
  id: idString,
  plotline_id: idString,
  scene_id: idString,
  order_index: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type PlotlineSceneRead = z.infer<typeof plotlineSceneReadSchema>;

/** Request body for attaching a scene to a plotline (`PlotlineSceneCreate`). */
export const plotlineSceneCreateSchema = z.object({
  scene_id: idString,
  order_index: z.number().int().default(0),
});
export type PlotlineSceneCreate = z.infer<typeof plotlineSceneCreateSchema>;

export const plotlineSceneListSchema = z.array(plotlineSceneReadSchema);

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

/* ---------------------------------------------------------------------------
 * FE↔BE contract ties (Feature #4). Each Read schema's inferred shape is bound
 * to the OpenAPI-generated backend type from `@alexandria/shared` (the single
 * source of truth). A field add/remove/rename — or an incompatible type drift —
 * on EITHER side breaks the matching `Expect<MatchesContract<…>>` and fails
 * `tsc`/`type-check`. These are compile-time only (erased at build); the Zod
 * schemas above remain the runtime validators. See the helper docs in
 * `@alexandria/shared`. (Replaces the retired fixture drift-guard.)
 * ------------------------------------------------------------------------- */
// One exported tuple binds every Read schema to its generated counterpart.
// `Expect<…>` forces each `MatchesContract` to be `true`; a drift makes one
// element `false`, violating the `extends true` bound → `tsc` error. Exported
// so it counts as used (no dead-code lint warning) and is importable as the
// documented contract surface for this module.
export type CoreContractTies = [
  Expect<MatchesContract<z.infer<typeof projectReadSchema>, GenProjectRead>>,
  Expect<MatchesContract<z.infer<typeof meReadSchema>, GenMeRead>>,
  Expect<MatchesContract<z.infer<typeof seriesReadSchema>, GenSeriesRead>>,
  Expect<MatchesContract<z.infer<typeof bookReadSchema>, GenBookRead>>,
  Expect<MatchesContract<z.infer<typeof chapterReadSchema>, GenChapterRead>>,
  Expect<MatchesContract<z.infer<typeof sceneReadSchema>, GenSceneRead>>,
  Expect<MatchesContract<z.infer<typeof beatReadSchema>, GenBeatRead>>,
  Expect<
    MatchesContract<z.infer<typeof codexEntryReadSchema>, GenCodexEntryRead>
  >,
  Expect<
    MatchesContract<
      z.infer<typeof promptTemplateReadSchema>,
      GenPromptTemplateRead
    >
  >,
  Expect<
    MatchesContract<
      z.infer<typeof codexRelationReadSchema>,
      GenCodexRelationRead
    >
  >,
  Expect<MatchesContract<z.infer<typeof plotlineReadSchema>, GenPlotlineRead>>,
  Expect<
    MatchesContract<
      z.infer<typeof plotlineSceneReadSchema>,
      GenPlotlineSceneRead
    >
  >,
];
