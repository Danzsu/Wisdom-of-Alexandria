/**
 * Realistic fixtures for the Projects/Books endpoints, matching the backend
 * schema shapes (`ProjectRead` / `BookRead`). Shared by the MSW handlers and by
 * component/hook tests.
 */
import type {
  BookRead,
  ChapterRead,
  CodexEntryRead,
  ProjectRead,
  SceneRead,
} from "@/lib/api/types";

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
    tags: ["főszereplő"],
    created_at: "2026-06-14T14:32:00Z",
    updated_at: "2026-06-14T14:32:00Z",
  },
];
