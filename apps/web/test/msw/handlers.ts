/**
 * MSW request handlers for the Projects/Books + AI endpoints. Returns fixtures
 * that match the real schema shapes so tests exercise the same parse/validation
 * path as production.
 */
import { http, HttpResponse } from "msw";
import { API_BASE_URL } from "@/lib/api/client";
import {
  AI_GENERATED_TEXT,
  CHAPTERS_FIXTURE,
  FAROSZ_BOOK,
  FAROSZ_CODEX,
  FAROSZ_PROJECT,
  MODELS_FIXTURE,
  PROJECTS_FIXTURE,
  SCENE_BEATS_FIXTURE,
  SCENES_BY_CHAPTER,
  makeAiResult,
  makeDescribeResult,
  makeRevision,
  makeSnippet,
} from "./fixtures";
import type {
  BookRead,
  ProjectRead,
  SceneRead,
} from "@/lib/api/types";
import type { DescribeRequest } from "@/lib/api/ai-types";

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

  http.get(`${base}/projects/:projectId/books`, ({ params }) => {
    // The Fárosz project owns the Fárosz book; other projects have none. This
    // lets `resolveProjectIdForBook` find the owning project for snippet POSTs.
    if (params.projectId === FAROSZ_PROJECT.id) {
      return HttpResponse.json([FAROSZ_BOOK]);
    }
    return HttpResponse.json([] as BookRead[]);
  }),

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

  /* ---- Beats (scene-scoped) ---- */
  http.get(`${base}/scenes/:sceneId/beats`, () =>
    HttpResponse.json(SCENE_BEATS_FIXTURE),
  ),
  http.post(`${base}/scenes/:sceneId/beats`, async ({ params, request }) => {
    const body = (await request.json()) as {
      description?: string;
      order_index?: number;
    };
    return HttpResponse.json(
      {
        id: "beat-new",
        scene_id: String(params.sceneId),
        description: body.description ?? "",
        beat_type: null,
        order_index: body.order_index ?? 0,
        notes: null,
        created_at: "2026-06-14T16:00:00Z",
        updated_at: "2026-06-14T16:00:00Z",
      },
      { status: 201 },
    );
  }),

  /* ---- AI (config-driven models + generation) ---- */
  http.get(`${base}/ai/models`, () => HttpResponse.json(MODELS_FIXTURE)),

  http.post(`${base}/ai/rewrite`, async ({ request }) => {
    const body = (await request.json()) as { model?: string | null };
    const model = body.model ?? MODELS_FIXTURE.default;
    return HttpResponse.json(makeAiResult("rewrite", AI_GENERATED_TEXT, model));
  }),

  http.post(`${base}/ai/write-continue`, async ({ request }) => {
    const body = (await request.json()) as { model?: string | null };
    const model = body.model ?? MODELS_FIXTURE.default;
    return HttpResponse.json(
      makeAiResult("write_continue", AI_GENERATED_TEXT, model),
    );
  }),

  http.post(`${base}/ai/generate-scene`, async ({ request }) => {
    const body = (await request.json()) as { model?: string | null };
    const model = body.model ?? MODELS_FIXTURE.default;
    return HttpResponse.json(
      makeAiResult("generate_scene", AI_GENERATED_TEXT, model),
    );
  }),

  http.post(`${base}/ai/describe`, async ({ request }) => {
    const body = (await request.json()) as DescribeRequest;
    const model = body.model ?? MODELS_FIXTURE.default;
    const channels = body.channels ?? [
      "Látás",
      "Hang",
      "Tapintás",
      "Szag",
      "Íz",
      "Metaforák",
    ];
    return HttpResponse.json(makeDescribeResult(channels, model));
  }),

  /* ---- Revision approval (the human-in-the-loop accept) ---- */
  http.post(
    `${base}/revisions/:revisionId/approve`,
    ({ params }) =>
      HttpResponse.json({
        ...makeRevision("rewrite", AI_GENERATED_TEXT, MODELS_FIXTURE.default),
        id: String(params.revisionId),
        approved: true,
      }),
  ),

  /* ---- Snippets (project-scoped, the Star action) ---- */
  http.post(
    `${base}/projects/:projectId/snippets`,
    async ({ params, request }) => {
      const body = (await request.json()) as {
        title?: string;
        content?: string;
        source_scene_id?: string | null;
        tags?: string[];
      };
      return HttpResponse.json(makeSnippet(String(params.projectId), body), {
        status: 201,
      });
    },
  ),
];
