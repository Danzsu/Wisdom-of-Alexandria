/**
 * MSW request handlers for the Projects/Books endpoints. Returns fixtures that
 * match the real schema shapes so tests exercise the same parse/validation path
 * as production.
 */
import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/lib/api/client";
import {
  CHAPTERS_FIXTURE,
  FAROSZ_CODEX,
  FAROSZ_PROJECT,
  PROJECTS_FIXTURE,
  SCENES_BY_CHAPTER,
} from "./fixtures";
import type {
  BookRead,
  ProjectRead,
  SceneRead,
} from "@/lib/api/types";

/** Recompute word count the way the backend does (whitespace split). */
function wordCount(text: string | null | undefined): number {
  if (!text) return 0;
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

const base = `${API_BASE_URL}/api/v1`;

/** Build a `ProjectRead` echo for a POST /projects body. */
function makeProject(body: Partial<ProjectRead>): ProjectRead {
  const now = "2026-06-14T15:00:00Z";
  return {
    id: "33333333-3333-3333-3333-333333333333",
    title: body.title ?? "Névtelen projekt",
    description: body.description ?? null,
    language: body.language ?? "hu",
    created_at: now,
    updated_at: now,
  };
}

/** Build a `BookRead` echo for a POST /projects/{pid}/books body. */
function makeBook(projectId: string, body: Partial<BookRead>): BookRead {
  const now = "2026-06-14T15:00:00Z";
  return {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    project_id: projectId,
    title: body.title ?? "Névtelen könyv",
    description: body.description ?? null,
    synopsis: body.synopsis ?? null,
    genre: body.genre ?? null,
    language: body.language ?? "hu",
    word_count_target: body.word_count_target ?? null,
    order_index: body.order_index ?? 0,
    created_at: now,
    updated_at: now,
  };
}

export const handlers = [
  http.get(`${base}/projects`, () => HttpResponse.json(PROJECTS_FIXTURE)),

  http.get(`${base}/projects/:projectId`, ({ params }) => {
    if (params.projectId === FAROSZ_PROJECT.id) {
      return HttpResponse.json(FAROSZ_PROJECT);
    }
    return HttpResponse.json({ detail: "Project not found" }, { status: 404 });
  }),

  http.post(`${base}/projects`, async ({ request }) => {
    const body = (await request.json()) as Partial<ProjectRead>;
    return HttpResponse.json(makeProject(body), { status: 201 });
  }),

  http.get(`${base}/projects/:projectId/books`, () =>
    HttpResponse.json([] as BookRead[]),
  ),

  http.post(`${base}/projects/:projectId/books`, async ({ params, request }) => {
    const body = (await request.json()) as Partial<BookRead>;
    return HttpResponse.json(makeBook(String(params.projectId), body), {
      status: 201,
    });
  }),

  /* ---- Chapters (book-scoped) ---- */
  http.get(`${base}/books/:bookId/chapters`, () =>
    HttpResponse.json(CHAPTERS_FIXTURE),
  ),

  /* ---- Scenes (chapter-scoped) ---- */
  http.get(`${base}/chapters/:chapterId/scenes`, ({ params }) =>
    HttpResponse.json(SCENES_BY_CHAPTER[String(params.chapterId)] ?? []),
  ),

  http.get(`${base}/chapters/:chapterId/scenes/:sceneId`, ({ params }) => {
    const scenes = SCENES_BY_CHAPTER[String(params.chapterId)] ?? [];
    const scene = scenes.find((s) => s.id === params.sceneId);
    if (!scene) {
      return HttpResponse.json({ detail: "Scene not found" }, { status: 404 });
    }
    return HttpResponse.json(scene);
  }),

  http.patch(
    `${base}/chapters/:chapterId/scenes/:sceneId`,
    async ({ params, request }) => {
      const scenes = SCENES_BY_CHAPTER[String(params.chapterId)] ?? [];
      const scene = scenes.find((s) => s.id === params.sceneId);
      if (!scene) {
        return HttpResponse.json({ detail: "Scene not found" }, { status: 404 });
      }
      const body = (await request.json()) as Partial<SceneRead>;
      const merged: SceneRead = {
        ...scene,
        ...body,
        // The backend recomputes word_count from content on update.
        word_count:
          body.content !== undefined
            ? wordCount(body.content)
            : scene.word_count,
        updated_at: "2026-06-14T16:00:00Z",
      };
      return HttpResponse.json(merged);
    },
  ),

  /* ---- Codex (project-scoped, read-only for M4) ---- */
  http.get(`${base}/projects/:projectId/codex`, () =>
    HttpResponse.json(FAROSZ_CODEX),
  ),
];
