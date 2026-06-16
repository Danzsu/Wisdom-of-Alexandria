/**
 * Realistic fixtures for the Projects/Books endpoints, matching the backend
 * schema shapes (`ProjectRead` / `BookRead`). Shared by the MSW handlers and by
 * component/hook tests.
 */
import type {
  BeatRead,
  BookRead,
  ChapterRead,
  CodexEntryRead,
  ProjectRead,
  SceneRead,
  SeriesCreate,
  SeriesRead,
} from "@/lib/api/types";
import type {
  AIContextEntity,
  AIDescribeResult,
  AIResult,
  ContinuityResult,
  ContinuityWarning,
  GenerationJobRead,
  ModelsResponse,
  RevisionRead,
  SnippetRead,
} from "@/lib/api/ai-types";
import type { ProviderCreate, ProviderRead } from "@/lib/api/providers";

export const FAROSZ_PROJECT: ProjectRead = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "A Fárosz őrzője",
  description: "történelmi fantasy",
  language: "hu",
  created_at: "2026-06-14T14:32:00Z",
  updated_at: "2026-06-14T14:32:00Z",
  // Feature #1 aggregates: one book, a non-trivial total word count (exercises
  // the hu-locale thousands grouping in the card meta line).
  book_count: 1,
  word_count: 12450,
};

export const HOMOK_PROJECT: ProjectRead = {
  id: "22222222-2222-2222-2222-222222222222",
  title: "Homoktenger levelei",
  description: "novella",
  language: "hu",
  created_at: "2026-06-11T09:10:00Z",
  updated_at: "2026-06-11T09:10:00Z",
  // No book yet → the card shows the "Nincs könyv · 0 szó" empty path.
  book_count: 0,
  word_count: 0,
};

/* ---------------------------------------------------------------------------
 * Series (Feature #3a). One series under the Fárosz project; the Fárosz book is
 * assigned to it (`series_id`). Codex entries can be project-global (`null`) or
 * scoped to this series — see FAROSZ_CODEX below.
 * ------------------------------------------------------------------------- */

export const FAROSZ_SERIES: SeriesRead = {
  id: "5e21e500-0000-0000-0000-000000000001",
  project_id: FAROSZ_PROJECT.id,
  title: "Az Alexandriai Ciklus",
  description: "A Nagykönyvtár köré épülő történetek.",
  order_index: 0,
  created_at: "2026-06-14T14:32:00Z",
  updated_at: "2026-06-14T14:32:00Z",
};

export const SERIES_FIXTURE: SeriesRead[] = [FAROSZ_SERIES];

export const FAROSZ_BOOK: BookRead = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  project_id: FAROSZ_PROJECT.id,
  // Assigned to the Fárosz series so the Codex "Sorozat" scope has a series to
  // filter by (project-global + this series' entries).
  series_id: FAROSZ_SERIES.id,
  title: "A Fárosz őrzője",
  description: null,
  synopsis: null,
  genre: "történelmi fantasy",
  language: "hu",
  word_count_target: 80000,
  order_index: 0,
  created_at: "2026-06-14T14:32:00Z",
  updated_at: "2026-06-14T14:32:00Z",
};

export const PROJECTS_FIXTURE: ProjectRead[] = [FAROSZ_PROJECT, HOMOK_PROJECT];

let seriesSeq = 0;

/** Build a `SeriesRead` echo for a POST /projects/{pid}/series body. */
export function makeSeries(
  projectId: string,
  body: SeriesCreate,
): SeriesRead {
  seriesSeq += 1;
  return {
    id: `series-new-${seriesSeq}`,
    project_id: projectId,
    title: body.title,
    description: body.description ?? null,
    order_index: body.order_index ?? 0,
    created_at: NOW,
    updated_at: NOW,
  };
}

/* ---------------------------------------------------------------------------
 * Chapters + scenes (M4 Write View). One book → two chapters; the second
 * chapter holds the active scene used by the Write View tests.
 * ------------------------------------------------------------------------- */

export const CHAPTER_ONE: ChapterRead = {
  id: "c1111111-1111-1111-1111-111111111111",
  book_id: FAROSZ_BOOK.id,
  title: "I. fejezet — A kikötő",
  summary: null,
  order_index: 0,
  status: "complete",
  created_at: "2026-06-14T14:32:00Z",
  updated_at: "2026-06-14T14:32:00Z",
};

export const CHAPTER_TWO: ChapterRead = {
  id: "c2222222-2222-2222-2222-222222222222",
  book_id: FAROSZ_BOOK.id,
  title: "II. fejezet — A könyvtár árnyai",
  summary: null,
  order_index: 1,
  status: "in_progress",
  created_at: "2026-06-14T14:32:00Z",
  updated_at: "2026-06-14T14:32:00Z",
};

export const CHAPTERS_FIXTURE: ChapterRead[] = [CHAPTER_ONE, CHAPTER_TWO];

export const SCENE_ACTIVE: SceneRead = {
  id: "5ce33333-3333-3333-3333-333333333333",
  chapter_id: CHAPTER_TWO.id,
  title: "3. jelenet — Rejtett jelek",
  content:
    "Szelene a tekercsek közé hajolt, és a lámpás fénye megremegett a papiruszok fölött.",
  summary: null,
  order_index: 2,
  status: "draft",
  word_count: 13,
  pov_character_id: null,
  created_at: "2026-06-14T14:32:00Z",
  updated_at: "2026-06-14T14:32:00Z",
};

export const SCENE_FIRST: SceneRead = {
  id: "5ce11111-1111-1111-1111-111111111111",
  chapter_id: CHAPTER_ONE.id,
  title: "1. jelenet — Az éjszakai műszak",
  content: "A kikötő csendes volt.",
  summary: null,
  order_index: 0,
  status: "complete",
  word_count: 4,
  pov_character_id: null,
  created_at: "2026-06-14T14:32:00Z",
  updated_at: "2026-06-14T14:32:00Z",
};

/** Scenes keyed by chapter id, for the per-chapter list handler. */
export const SCENES_BY_CHAPTER: Record<string, SceneRead[]> = {
  [CHAPTER_ONE.id]: [SCENE_FIRST],
  [CHAPTER_TWO.id]: [SCENE_ACTIVE],
};

let chapterSeq = 0;
let sceneSeq = 0;

/** Build a `ChapterRead` echo for a POST /books/{bid}/chapters body. */
export function makeChapter(
  bookId: string,
  body: {
    title?: string;
    summary?: string | null;
    order_index?: number;
    status?: string;
  },
): ChapterRead {
  chapterSeq += 1;
  return {
    id: `chapter-new-${chapterSeq}`,
    book_id: bookId,
    title: body.title ?? "Névtelen fejezet",
    summary: body.summary ?? null,
    order_index: body.order_index ?? 0,
    status: body.status ?? "draft",
    created_at: NOW,
    updated_at: NOW,
  };
}

/** Recompute word count the way the backend does (whitespace split). */
function fixtureWordCount(text: string | null | undefined): number {
  if (!text) return 0;
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/** Build a `SceneRead` echo for a POST /chapters/{cid}/scenes body. */
export function makeScene(
  chapterId: string,
  body: {
    title?: string;
    content?: string | null;
    summary?: string | null;
    order_index?: number;
    status?: string;
    pov_character_id?: string | null;
  },
): SceneRead {
  sceneSeq += 1;
  return {
    id: `scene-new-${sceneSeq}`,
    chapter_id: chapterId,
    title: body.title ?? "Névtelen jelenet",
    content: body.content ?? null,
    summary: body.summary ?? null,
    order_index: body.order_index ?? 0,
    status: body.status ?? "draft",
    word_count: fixtureWordCount(body.content),
    pov_character_id: body.pov_character_id ?? null,
    created_at: NOW,
    updated_at: NOW,
  };
}

export const FAROSZ_CODEX: CodexEntryRead[] = [
  {
    id: "codex-szelene",
    project_id: FAROSZ_PROJECT.id,
    // Project-global entry (visible in every scope).
    series_id: null,
    title: "Szelene",
    entry_type: "character",
    content: "A Nagykönyvtár éjszakai írnoka.",
    // P1.4 — dedicated columns: aliases + role; "főszereplő" is a plain label.
    aliases: ["Lené"],
    role: "Protagonista",
    ai_visible: true,
    tags: ["főszereplő"],
    created_at: "2026-06-14T14:32:00Z",
    updated_at: "2026-06-14T14:32:00Z",
  },
  {
    id: "codex-nagykonyvtar",
    project_id: FAROSZ_PROJECT.id,
    // Series-scoped entry — only appears in the project scope + the Fárosz
    // series scope, NOT in another series' scope.
    series_id: FAROSZ_SERIES.id,
    title: "Nagykönyvtár",
    entry_type: "location",
    content: "A keleti szárny és a tiltott termek.",
    aliases: [],
    role: null,
    ai_visible: true,
    tags: [],
    created_at: "2026-06-14T14:32:00Z",
    updated_at: "2026-06-14T14:32:00Z",
  },
];

let codexSeq = 0;

/** Build a `CodexEntryRead` echo for a POST /projects/{pid}/codex body. */
export function makeCodexEntry(
  projectId: string,
  body: {
    title?: string;
    entry_type?: string;
    content?: string | null;
    aliases?: string[];
    role?: string | null;
    ai_visible?: boolean;
    tags?: string[];
    series_id?: string | null;
  },
): CodexEntryRead {
  codexSeq += 1;
  return {
    id: `codex-new-${codexSeq}`,
    project_id: projectId,
    series_id: body.series_id ?? null,
    title: body.title ?? "Névtelen bejegyzés",
    entry_type: body.entry_type ?? "custom",
    content: body.content ?? null,
    aliases: body.aliases ?? [],
    role: body.role ?? null,
    ai_visible: body.ai_visible ?? true,
    tags: body.tags ?? [],
    created_at: NOW,
    updated_at: NOW,
  };
}

/* ---------------------------------------------------------------------------
 * AI flow fixtures (M5) — mirror app/api/v1/ai.py response shapes.
 * ------------------------------------------------------------------------- */

const NOW = "2026-06-14T16:00:00Z";

/** Config-driven model list (mirrors GET /ai/models → ModelsResponse). */
export const MODELS_FIXTURE: ModelsResponse = {
  models: [{ id: "ollama/llama3.2", label: "llama3.2", kind: "local", moderated: false }],
  default: "ollama/llama3.2",
};

/** The text a successful rewrite/generate returns (used to assert insertion). */
export const AI_GENERATED_TEXT =
  "Szelene meg sem rezzent. Ujjai lassan végigvándoroltak a tekercs peremén, míg el nem érték a rejtett jeleket.";

/**
 * Sample RAG context entities the rewrite/generate result is grounded on
 * (mirrors the backend `ContextEntity = {id, label, entity_type}`). One
 * character + one location so the chip-rendering test has both a known
 * entity_type→icon mapping to assert. describe returns NONE (RAG is not used
 * there) — its fixture keeps `context_entities: []`.
 */
export const CONTEXT_ENTITIES_FIXTURE: AIContextEntity[] = [
  { id: "codex-szelene", label: "Szelene", entity_type: "character" },
  { id: "codex-nagykonyvtar", label: "Nagykönyvtár", entity_type: "location" },
];

let revisionSeq = 0;

/** Build a `GenerationJobRead` echo. */
function makeJob(jobType: string, model: string): GenerationJobRead {
  return {
    id: `job-${jobType}-${revisionSeq}`,
    scene_id: SCENE_ACTIVE.id,
    chapter_id: null,
    job_type: jobType,
    status: "done",
    model_name: model,
    prompt_version: "1.0",
    input_data: {},
    output_data: {},
    error_message: null,
    created_at: NOW,
    updated_at: NOW,
  };
}

/** Build an unapproved `RevisionRead` (the human-in-the-loop pending state). */
export function makeRevision(
  revisionType: string,
  content: string,
  model: string,
): RevisionRead {
  revisionSeq += 1;
  return {
    id: `rev-${revisionType}-${revisionSeq}`,
    scene_id: SCENE_ACTIVE.id,
    job_id: `job-${revisionType}-${revisionSeq}`,
    content,
    approved: false,
    revision_type: revisionType,
    model_name: model,
    prompt_version: "1.0",
    created_at: NOW,
    updated_at: NOW,
  };
}

/**
 * Build an `AIResult` (single revision + job + retrieved RAG context). Carries
 * the {@link CONTEXT_ENTITIES_FIXTURE} (character + location) by default so the
 * chip-rendering tests have data; pass `[]` to exercise the no-context path.
 */
export function makeAiResult(
  revisionType: string,
  content: string,
  model: string,
  contextEntities: AIContextEntity[] = CONTEXT_ENTITIES_FIXTURE,
): AIResult {
  return {
    revision: makeRevision(revisionType, content, model),
    job: makeJob(revisionType, model),
    context_entities: contextEntities,
  };
}

/**
 * Build an `AIDescribeResult` — one revision per requested channel. describe
 * does NOT use RAG, so `context_entities` is always empty (matches the backend).
 */
export function makeDescribeResult(
  channels: string[],
  model: string,
): AIDescribeResult {
  return {
    revisions: channels.map((c) =>
      makeRevision("describe_channel", `${c}: érzéki leírás a jelenethez.`, model),
    ),
    job: makeJob("describe", model),
    context_entities: [],
  };
}

/* ---------------------------------------------------------------------------
 * Continuity check (B3) — mirror app/api/v1/ai.py (ContinuityResult).
 *
 * The default fixture carries TWO warnings of MIXED severity — one `error` WITH
 * an affected entity, one `warning` with `entity: null` — so the Warnings-tab
 * test can assert both the severity rendering and the entity chip. Pass a custom
 * list (or `[]`) to exercise the no-issues / malformed paths.
 * ------------------------------------------------------------------------- */

/** Two mixed-severity warnings; the first names an entity, the second does not. */
export const CONTINUITY_WARNINGS_FIXTURE: ContinuityWarning[] = [
  {
    severity: "error",
    message: "Szelene a 2. fejezetben elutazik, de itt jelen van.",
    entity: "Szelene",
  },
  {
    severity: "warning",
    message: "A jelenet napszaka nincs megadva.",
    entity: null,
  },
];

/** Build a `ContinuityResult` (warnings + grounded RAG context). */
export function makeContinuityResult(
  warnings: ContinuityWarning[] = CONTINUITY_WARNINGS_FIXTURE,
  contextEntities: AIContextEntity[] = [],
): ContinuityResult {
  return { warnings, context_entities: contextEntities };
}

/** Build a `SnippetRead` echo for a POST /projects/{pid}/snippets body. */
export function makeSnippet(
  projectId: string,
  body: { title?: string; content?: string; source_scene_id?: string | null; tags?: string[] },
): SnippetRead {
  return {
    id: "snippet-1",
    project_id: projectId,
    title: body.title ?? "Snippet",
    content: body.content ?? "",
    source_scene_id: body.source_scene_id ?? null,
    tags: body.tags ?? [],
    created_at: NOW,
    updated_at: NOW,
  };
}

/* ---------------------------------------------------------------------------
 * Providers (P1.1) — mirror app/schemas/provider.py (ProviderRead).
 *
 * SECURITY: a ProviderRead NEVER carries the real api_key — only the masked
 * preview (`api_key_masked`) + `has_key`. The fixtures + makeProvider echo only
 * the mask, exactly like the real backend.
 * ------------------------------------------------------------------------- */

/** A cloud provider WITH a stored key (mask shown, never the raw key). */
export const PROVIDER_GEMINI: ProviderRead = {
  id: "prov-gemini-1",
  type: "gemini",
  label: "Gemini (alap)",
  api_key_masked: "••••3f8a",
  has_key: true,
  base_url: null,
  default_model: "gemini-2.0-flash",
  enabled: true,
  created_at: NOW,
  updated_at: NOW,
};

/** A local (ollama) provider — no key needed, base_url only. */
export const PROVIDER_OLLAMA: ProviderRead = {
  id: "prov-ollama-1",
  type: "ollama",
  label: "Ollama (helyi)",
  api_key_masked: null,
  has_key: false,
  base_url: "http://localhost:11434",
  default_model: "llama3.2",
  enabled: true,
  created_at: NOW,
  updated_at: NOW,
};

export const PROVIDERS_FIXTURE: ProviderRead[] = [
  PROVIDER_GEMINI,
  PROVIDER_OLLAMA,
];

let providerSeq = 0;

/**
 * Build a `ProviderRead` echo for a POST /providers body. Derives the masked
 * preview from the supplied plaintext key (last 4 chars) — the raw key is
 * NEVER stored or echoed back, mirroring the real backend.
 */
export function makeProvider(body: ProviderCreate): ProviderRead {
  providerSeq += 1;
  const hasKey = Boolean(body.api_key);
  return {
    id: `prov-new-${providerSeq}`,
    type: body.type,
    label: body.label,
    api_key_masked: hasKey ? maskKey(body.api_key as string) : null,
    has_key: hasKey,
    base_url: body.base_url ?? null,
    default_model: body.default_model ?? null,
    enabled: body.enabled ?? true,
    created_at: NOW,
    updated_at: NOW,
  };
}

/** Mask a plaintext key the way the backend does: bullets + last 4 chars. */
export function maskKey(key: string): string {
  const tail = key.slice(-4);
  return `••••${tail}`;
}

/* ---------------------------------------------------------------------------
 * Generation jobs (B1) — the live AI-feladatok screen + nav badge fixtures.
 *
 * Statuses are the REAL backend `JobStatus` values (pending/running/done/
 * failed). The set spans every status and includes ONE failed job so the
 * screen's error rendering + the badge's failed-count both have data. All
 * scoped to the Fárosz book's active scene.
 * ------------------------------------------------------------------------- */
export const JOB_DONE: GenerationJobRead = {
  id: "job-done-1",
  scene_id: SCENE_ACTIVE.id,
  chapter_id: null,
  job_type: "rewrite",
  status: "done",
  model_name: "ollama/llama3.2",
  prompt_version: "1.0",
  input_data: {},
  output_data: { ok: true },
  error_message: null,
  created_at: "2026-06-15T11:00:00Z",
  updated_at: "2026-06-15T11:00:01Z",
};

export const JOB_RUNNING: GenerationJobRead = {
  id: "job-running-1",
  scene_id: SCENE_ACTIVE.id,
  chapter_id: null,
  job_type: "generate_scene",
  status: "running",
  model_name: "ollama/llama3.2",
  prompt_version: "1.0",
  input_data: {},
  output_data: null,
  error_message: null,
  created_at: "2026-06-15T11:05:00Z",
  updated_at: "2026-06-15T11:05:00Z",
};

export const JOB_FAILED: GenerationJobRead = {
  id: "job-failed-1",
  scene_id: SCENE_ACTIVE.id,
  chapter_id: null,
  job_type: "describe",
  status: "failed",
  model_name: "ollama/llama3.2",
  prompt_version: "1.0",
  input_data: {},
  output_data: null,
  error_message: "A modell időtúllépés miatt nem válaszolt.",
  created_at: "2026-06-15T11:10:00Z",
  updated_at: "2026-06-15T11:10:02Z",
};

/** Jobs newest-first, mirroring the backend `created_at desc` ordering. */
export const JOBS_FIXTURE: GenerationJobRead[] = [
  JOB_FAILED,
  JOB_RUNNING,
  JOB_DONE,
];

/** Scene beats fixture (mirrors GET /scenes/{id}/beats). */
export const SCENE_BEATS_FIXTURE: BeatRead[] = [
  {
    id: "beat-1",
    scene_id: SCENE_ACTIVE.id,
    description: "Szelene felfedezi a rejtett jeleket a tekercsen.",
    beat_type: "alkalmazva",
    order_index: 0,
    notes: null,
    created_at: "2026-06-14T14:32:00Z",
    updated_at: "2026-06-14T14:32:00Z",
  },
];
