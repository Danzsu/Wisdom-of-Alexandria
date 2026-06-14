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
} from "@/lib/api/types";
import type {
  AIDescribeResult,
  AIResult,
  GenerationJobRead,
  ModelsResponse,
  RevisionRead,
  SnippetRead,
} from "@/lib/api/ai-types";

export const FAROSZ_PROJECT: ProjectRead = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "A Fárosz őrzője",
  description: "történelmi fantasy",
  language: "hu",
  created_at: "2026-06-14T14:32:00Z",
  updated_at: "2026-06-14T14:32:00Z",
};

export const HOMOK_PROJECT: ProjectRead = {
  id: "22222222-2222-2222-2222-222222222222",
  title: "Homoktenger levelei",
  description: "novella",
  language: "hu",
  created_at: "2026-06-11T09:10:00Z",
  updated_at: "2026-06-11T09:10:00Z",
};

export const FAROSZ_BOOK: BookRead = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  project_id: FAROSZ_PROJECT.id,
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

export const FAROSZ_CODEX: CodexEntryRead[] = [
  {
    id: "codex-szelene",
    project_id: FAROSZ_PROJECT.id,
    title: "Szelene",
    entry_type: "character",
    content: "A Nagykönyvtár éjszakai írnoka.",
    ai_visible: true,
    // The __woa: codec folds aliases + story role into the real `tags` list
    // (see lib/api/codex.ts); "főszereplő" is a plain user label.
    tags: ["__woa:alias=Lené", "__woa:role=Protagonista", "főszereplő"],
    created_at: "2026-06-14T14:32:00Z",
    updated_at: "2026-06-14T14:32:00Z",
  },
  {
    id: "codex-nagykonyvtar",
    project_id: FAROSZ_PROJECT.id,
    title: "Nagykönyvtár",
    entry_type: "location",
    content: "A keleti szárny és a tiltott termek.",
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
    ai_visible?: boolean;
    tags?: string[];
  },
): CodexEntryRead {
  codexSeq += 1;
  return {
    id: `codex-new-${codexSeq}`,
    project_id: projectId,
    title: body.title ?? "Névtelen bejegyzés",
    entry_type: body.entry_type ?? "custom",
    content: body.content ?? null,
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

let revisionSeq = 0;

/** Build a `GenerationJobRead` echo. */
function makeJob(jobType: string, model: string): GenerationJobRead {
  return {
    id: `job-${jobType}-${revisionSeq}`,
    scene_id: SCENE_ACTIVE.id,
    chapter_id: null,
    job_type: jobType,
    status: "completed",
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

/** Build an `AIResult` (single revision + job). */
export function makeAiResult(
  revisionType: string,
  content: string,
  model: string,
): AIResult {
  return {
    revision: makeRevision(revisionType, content, model),
    job: makeJob(revisionType, model),
  };
}

/** Build an `AIDescribeResult` — one revision per requested channel. */
export function makeDescribeResult(
  channels: string[],
  model: string,
): AIDescribeResult {
  return {
    revisions: channels.map((c) =>
      makeRevision("describe_channel", `${c}: érzéki leírás a jelenethez.`, model),
    ),
    job: makeJob("describe", model),
  };
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
