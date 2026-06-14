/**
 * Realistic fixtures for the Projects/Books endpoints, matching the backend
 * schema shapes (`ProjectRead` / `BookRead`). Shared by the MSW handlers and by
 * component/hook tests.
 */
import type { BookRead, ProjectRead } from "@/lib/api/types";

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
