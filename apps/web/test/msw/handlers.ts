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
  PROVIDERS_FIXTURE,
  SCENE_BEATS_FIXTURE,
  SCENES_BY_CHAPTER,
  makeAiResult,
  makeChapter,
  makeCodexEntry,
  makeDescribeResult,
  makeProvider,
  makeRevision,
  makeScene,
  makeSnippet,
  maskKey,
} from "./fixtures";
import type {
  BookRead,
  ChapterCreate,
  ChapterRead,
  ChapterUpdate,
  CodexEntryCreate,
  CodexEntryRead,
  CodexEntryUpdate,
  ProjectRead,
  SceneCreate,
  SceneRead,
  SceneUpdate,
} from "@/lib/api/types";
import type { DescribeRequest } from "@/lib/api/ai-types";
import type {
  ProviderCreate,
  ProviderRead,
  ProviderUpdate,
} from "@/lib/api/providers";

/** Recompute word count the way the backend does (whitespace split). */
function wordCount(text: string | null | undefined): number {
  if (!text) return 0;
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

const base = `${API_BASE_URL}/api/v1`;

/* ---------------------------------------------------------------------------
 * In-memory Codex store — gives the CRUD handlers realistic, stateful behaviour
 * within a test (create then list shows the new entry; patch/delete mutate it).
 * Seeded from FAROSZ_CODEX; call `codexStore.reset()` in a test's beforeEach to
 * isolate state between tests.
 * ------------------------------------------------------------------------- */
const codexStore = {
  byProject: new Map<string, CodexEntryRead[]>(),

  seed(): void {
    this.byProject = new Map<string, CodexEntryRead[]>();
    this.byProject.set(
      FAROSZ_PROJECT.id,
      FAROSZ_CODEX.map((e) => ({ ...e })),
    );
  },

  reset(): void {
    this.seed();
  },

  list(projectId: string): CodexEntryRead[] {
    return this.byProject.get(projectId) ?? [];
  },

  get(projectId: string, entryId: string): CodexEntryRead | undefined {
    return this.list(projectId).find((e) => e.id === entryId);
  },

  create(projectId: string, body: CodexEntryCreate): CodexEntryRead {
    const created = makeCodexEntry(projectId, body);
    const list = this.byProject.get(projectId) ?? [];
    list.push(created);
    this.byProject.set(projectId, list);
    return created;
  },

  update(
    projectId: string,
    entryId: string,
    patch: CodexEntryUpdate,
  ): CodexEntryRead | undefined {
    const list = this.byProject.get(projectId);
    if (!list) return undefined;
    const index = list.findIndex((e) => e.id === entryId);
    if (index === -1) return undefined;
    const merged: CodexEntryRead = {
      ...list[index],
      ...patch,
      updated_at: "2026-06-14T17:00:00Z",
    };
    list[index] = merged;
    return merged;
  },

  remove(projectId: string, entryId: string): boolean {
    const list = this.byProject.get(projectId);
    if (!list) return false;
    const index = list.findIndex((e) => e.id === entryId);
    if (index === -1) return false;
    list.splice(index, 1);
    return true;
  },
};
codexStore.seed();

/** Reset the in-memory Codex store (call in a test's beforeEach for isolation). */
export function resetCodexStore(): void {
  codexStore.reset();
}

/* ---------------------------------------------------------------------------
 * In-memory Chapter + Scene store (M7) — stateful CRUD/reorder so the Plan
 * Board and ChapterTree tests exercise create → list → reorder/delete flows.
 * Seeded from CHAPTERS_FIXTURE + SCENES_BY_CHAPTER. Call `resetPlanStore()` in a
 * test's beforeEach for isolation. Mirrors the real backend semantics:
 *  - chapters listed sorted by order_index,
 *  - scenes listed sorted by order_index, archived excluded by default,
 *  - reorder assigns order_index by position for the ids present,
 *  - archive sets status="archived",
 *  - chapter delete cascades to its scenes.
 * ------------------------------------------------------------------------- */
const planStore = {
  chaptersByBook: new Map<string, ChapterRead[]>(),
  scenesByChapter: new Map<string, SceneRead[]>(),

  seed(): void {
    this.chaptersByBook = new Map<string, ChapterRead[]>();
    this.scenesByChapter = new Map<string, SceneRead[]>();
    this.chaptersByBook.set(
      FAROSZ_BOOK.id,
      CHAPTERS_FIXTURE.map((c) => ({ ...c })),
    );
    for (const [chapterId, scenes] of Object.entries(SCENES_BY_CHAPTER)) {
      this.scenesByChapter.set(
        chapterId,
        scenes.map((s) => ({ ...s })),
      );
    }
  },

  reset(): void {
    this.seed();
  },

  listChapters(bookId: string): ChapterRead[] {
    const list = this.chaptersByBook.get(bookId) ?? [];
    return [...list].sort((a, b) => a.order_index - b.order_index);
  },

  createChapter(bookId: string, body: ChapterCreate): ChapterRead {
    const created = makeChapter(bookId, body);
    const list = this.chaptersByBook.get(bookId) ?? [];
    list.push(created);
    this.chaptersByBook.set(bookId, list);
    this.scenesByChapter.set(created.id, []);
    return created;
  },

  updateChapter(
    bookId: string,
    chapterId: string,
    patch: ChapterUpdate,
  ): ChapterRead | undefined {
    const list = this.chaptersByBook.get(bookId);
    if (!list) return undefined;
    const index = list.findIndex((c) => c.id === chapterId);
    if (index === -1) return undefined;
    const merged: ChapterRead = {
      ...list[index],
      ...patch,
      updated_at: "2026-06-14T17:00:00Z",
    };
    list[index] = merged;
    return merged;
  },

  deleteChapter(bookId: string, chapterId: string): boolean {
    const list = this.chaptersByBook.get(bookId);
    if (!list) return false;
    const index = list.findIndex((c) => c.id === chapterId);
    if (index === -1) return false;
    list.splice(index, 1);
    this.scenesByChapter.delete(chapterId); // cascade
    return true;
  },

  reorderChapters(bookId: string, order: string[]): ChapterRead[] {
    const list = this.chaptersByBook.get(bookId) ?? [];
    const byId = new Map(list.map((c) => [c.id, c]));
    order.forEach((id, idx) => {
      const chapter = byId.get(id);
      if (chapter) chapter.order_index = idx;
    });
    return this.listChapters(bookId);
  },

  listScenes(chapterId: string, includeArchived = false): SceneRead[] {
    const list = this.scenesByChapter.get(chapterId) ?? [];
    return [...list]
      .filter((s) => includeArchived || s.status !== "archived")
      .sort((a, b) => a.order_index - b.order_index);
  },

  getScene(chapterId: string, sceneId: string): SceneRead | undefined {
    return (this.scenesByChapter.get(chapterId) ?? []).find(
      (s) => s.id === sceneId,
    );
  },

  createScene(chapterId: string, body: SceneCreate): SceneRead {
    const created = makeScene(chapterId, body);
    const list = this.scenesByChapter.get(chapterId) ?? [];
    list.push(created);
    this.scenesByChapter.set(chapterId, list);
    return created;
  },

  updateScene(
    chapterId: string,
    sceneId: string,
    patch: SceneUpdate,
  ): SceneRead | undefined {
    const list = this.scenesByChapter.get(chapterId);
    if (!list) return undefined;
    const index = list.findIndex((s) => s.id === sceneId);
    if (index === -1) return undefined;
    const merged: SceneRead = {
      ...list[index],
      ...patch,
      word_count:
        patch.content !== undefined
          ? wordCount(patch.content)
          : list[index].word_count,
      updated_at: "2026-06-14T16:00:00Z",
    };
    list[index] = merged;
    return merged;
  },

  deleteScene(chapterId: string, sceneId: string): boolean {
    const list = this.scenesByChapter.get(chapterId);
    if (!list) return false;
    const index = list.findIndex((s) => s.id === sceneId);
    if (index === -1) return false;
    list.splice(index, 1);
    return true;
  },

  archiveScene(chapterId: string, sceneId: string): SceneRead | undefined {
    const scene = this.getScene(chapterId, sceneId);
    if (!scene) return undefined;
    scene.status = "archived";
    scene.updated_at = "2026-06-14T16:00:00Z";
    return scene;
  },

  reorderScenes(chapterId: string, order: string[]): SceneRead[] {
    const list = this.scenesByChapter.get(chapterId) ?? [];
    const byId = new Map(list.map((s) => [s.id, s]));
    order.forEach((id, idx) => {
      const scene = byId.get(id);
      if (scene) scene.order_index = idx;
    });
    return this.listScenes(chapterId);
  },
};
planStore.seed();

/** Reset the in-memory chapter/scene store (call in a test's beforeEach). */
export function resetPlanStore(): void {
  planStore.reset();
}

/* ---------------------------------------------------------------------------
 * In-memory Provider store (P1.1) — stateful CRUD so the Cloud subpage tests
 * exercise list → create → edit → delete flows against masked reads.
 *
 * SECURITY: the store NEVER returns the raw key. A create/update with a
 * plaintext `api_key` stores only its mask (`••••<last4>`) + sets `has_key`; an
 * update that OMITS `api_key` keeps the existing mask/has_key untouched. Tests
 * assert no raw key is ever rendered. Call `resetProviderStore()` in beforeEach.
 * ------------------------------------------------------------------------- */
const providerStore = {
  items: [] as ProviderRead[],

  seed(): void {
    this.items = PROVIDERS_FIXTURE.map((p) => ({ ...p }));
  },

  reset(): void {
    this.seed();
  },

  list(enabledOnly: boolean): ProviderRead[] {
    return enabledOnly ? this.items.filter((p) => p.enabled) : [...this.items];
  },

  get(id: string): ProviderRead | undefined {
    return this.items.find((p) => p.id === id);
  },

  create(body: ProviderCreate): ProviderRead {
    const created = makeProvider(body);
    this.items.push(created);
    return created;
  },

  update(id: string, patch: ProviderUpdate): ProviderRead | undefined {
    const index = this.items.findIndex((p) => p.id === id);
    if (index === -1) return undefined;
    const current = this.items[index];
    // Only replace the masked key when a NEW plaintext key is sent; an omitted
    // api_key keeps the stored mask/has_key (the "keep existing" contract).
    const keyFields =
      patch.api_key === undefined
        ? {
            api_key_masked: current.api_key_masked,
            has_key: current.has_key,
          }
        : {
            api_key_masked: patch.api_key ? maskKey(patch.api_key) : null,
            has_key: Boolean(patch.api_key),
          };
    const merged: ProviderRead = {
      ...current,
      label: patch.label ?? current.label,
      base_url:
        patch.base_url !== undefined ? patch.base_url : current.base_url,
      default_model:
        patch.default_model !== undefined
          ? patch.default_model
          : current.default_model,
      enabled: patch.enabled ?? current.enabled,
      ...keyFields,
      updated_at: "2026-06-15T12:00:00Z",
    };
    this.items[index] = merged;
    return merged;
  },

  remove(id: string): boolean {
    const index = this.items.findIndex((p) => p.id === id);
    if (index === -1) return false;
    this.items.splice(index, 1);
    return true;
  },
};
providerStore.seed();

/** Reset the in-memory provider store (call in a test's beforeEach). */
export function resetProviderStore(): void {
  providerStore.reset();
}

/**
 * Create a provider in the in-memory store (for tests that override the POST
 * handler to capture the body but still want the new provider to appear in the
 * subsequent list refetch). Returns the masked `ProviderRead` echo.
 */
export function createProviderInStore(body: ProviderCreate): ProviderRead {
  return providerStore.create(body);
}

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

  /* ---- Chapters (book-scoped, full CRUD + reorder — M7) ---- */
  http.get(`${base}/books/:bookId/chapters`, ({ params }) =>
    HttpResponse.json(planStore.listChapters(String(params.bookId))),
  ),

  http.post(
    `${base}/books/:bookId/chapters`,
    async ({ params, request }) => {
      const body = (await request.json()) as ChapterCreate;
      const created = planStore.createChapter(String(params.bookId), body);
      return HttpResponse.json(created, { status: 201 });
    },
  ),

  http.post(
    `${base}/books/:bookId/chapters/reorder`,
    async ({ params, request }) => {
      const body = (await request.json()) as { order: string[] };
      return HttpResponse.json(
        planStore.reorderChapters(String(params.bookId), body.order),
      );
    },
  ),

  http.patch(
    `${base}/books/:bookId/chapters/:chapterId`,
    async ({ params, request }) => {
      const body = (await request.json()) as ChapterUpdate;
      const updated = planStore.updateChapter(
        String(params.bookId),
        String(params.chapterId),
        body,
      );
      if (!updated) {
        return HttpResponse.json(
          { detail: "Chapter not found" },
          { status: 404 },
        );
      }
      return HttpResponse.json(updated);
    },
  ),

  http.delete(`${base}/books/:bookId/chapters/:chapterId`, ({ params }) => {
    const ok = planStore.deleteChapter(
      String(params.bookId),
      String(params.chapterId),
    );
    if (!ok) {
      return HttpResponse.json({ detail: "Chapter not found" }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  /* ---- Scenes (chapter-scoped, full CRUD + reorder + archive — M7) ---- */
  http.get(`${base}/chapters/:chapterId/scenes`, ({ params, request }) => {
    const includeArchived =
      new URL(request.url).searchParams.get("include_archived") === "true";
    return HttpResponse.json(
      planStore.listScenes(String(params.chapterId), includeArchived),
    );
  }),

  http.post(
    `${base}/chapters/:chapterId/scenes`,
    async ({ params, request }) => {
      const body = (await request.json()) as SceneCreate;
      const created = planStore.createScene(String(params.chapterId), body);
      return HttpResponse.json(created, { status: 201 });
    },
  ),

  http.post(
    `${base}/chapters/:chapterId/scenes/reorder`,
    async ({ params, request }) => {
      const body = (await request.json()) as { order: string[] };
      return HttpResponse.json(
        planStore.reorderScenes(String(params.chapterId), body.order),
      );
    },
  ),

  http.get(`${base}/chapters/:chapterId/scenes/:sceneId`, ({ params }) => {
    const scene = planStore.getScene(
      String(params.chapterId),
      String(params.sceneId),
    );
    if (!scene) {
      return HttpResponse.json({ detail: "Scene not found" }, { status: 404 });
    }
    return HttpResponse.json(scene);
  }),

  http.patch(
    `${base}/chapters/:chapterId/scenes/:sceneId`,
    async ({ params, request }) => {
      const body = (await request.json()) as SceneUpdate;
      const updated = planStore.updateScene(
        String(params.chapterId),
        String(params.sceneId),
        body,
      );
      if (!updated) {
        return HttpResponse.json({ detail: "Scene not found" }, { status: 404 });
      }
      return HttpResponse.json(updated);
    },
  ),

  http.delete(`${base}/chapters/:chapterId/scenes/:sceneId`, ({ params }) => {
    const ok = planStore.deleteScene(
      String(params.chapterId),
      String(params.sceneId),
    );
    if (!ok) {
      return HttpResponse.json({ detail: "Scene not found" }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(
    `${base}/chapters/:chapterId/scenes/:sceneId/archive`,
    ({ params }) => {
      const archived = planStore.archiveScene(
        String(params.chapterId),
        String(params.sceneId),
      );
      if (!archived) {
        return HttpResponse.json({ detail: "Scene not found" }, { status: 404 });
      }
      return HttpResponse.json(archived);
    },
  ),

  /* ---- Codex (project-scoped, full CRUD — M6) ---- */
  http.get(`${base}/projects/:projectId/codex`, ({ params }) =>
    HttpResponse.json(codexStore.list(String(params.projectId))),
  ),

  http.get(`${base}/projects/:projectId/codex/:entryId`, ({ params }) => {
    const entry = codexStore.get(
      String(params.projectId),
      String(params.entryId),
    );
    if (!entry) {
      return HttpResponse.json(
        { detail: "Codex entry not found" },
        { status: 404 },
      );
    }
    return HttpResponse.json(entry);
  }),

  http.post(
    `${base}/projects/:projectId/codex`,
    async ({ params, request }) => {
      const body = (await request.json()) as CodexEntryCreate;
      const created = codexStore.create(String(params.projectId), body);
      return HttpResponse.json(created, { status: 201 });
    },
  ),

  http.patch(
    `${base}/projects/:projectId/codex/:entryId`,
    async ({ params, request }) => {
      const body = (await request.json()) as CodexEntryUpdate;
      const updated = codexStore.update(
        String(params.projectId),
        String(params.entryId),
        body,
      );
      if (!updated) {
        return HttpResponse.json(
          { detail: "Codex entry not found" },
          { status: 404 },
        );
      }
      return HttpResponse.json(updated);
    },
  ),

  http.delete(
    `${base}/projects/:projectId/codex/:entryId`,
    ({ params }) => {
      const ok = codexStore.remove(
        String(params.projectId),
        String(params.entryId),
      );
      if (!ok) {
        return HttpResponse.json(
          { detail: "Codex entry not found" },
          { status: 404 },
        );
      }
      return new HttpResponse(null, { status: 204 });
    },
  ),

  /* ---- Providers (P1.1 — full CRUD + test + models, masked reads) ---- */
  http.get(`${base}/providers`, ({ request }) => {
    const enabledOnly =
      new URL(request.url).searchParams.get("enabled_only") === "true";
    return HttpResponse.json(providerStore.list(enabledOnly));
  }),

  http.get(`${base}/providers/:providerId`, ({ params }) => {
    const provider = providerStore.get(String(params.providerId));
    if (!provider) {
      return HttpResponse.json({ detail: "Provider not found" }, { status: 404 });
    }
    return HttpResponse.json(provider);
  }),

  http.post(`${base}/providers`, async ({ request }) => {
    const body = (await request.json()) as ProviderCreate;
    return HttpResponse.json(providerStore.create(body), { status: 201 });
  }),

  http.patch(`${base}/providers/:providerId`, async ({ params, request }) => {
    const body = (await request.json()) as ProviderUpdate;
    const updated = providerStore.update(String(params.providerId), body);
    if (!updated) {
      return HttpResponse.json({ detail: "Provider not found" }, { status: 404 });
    }
    return HttpResponse.json(updated);
  }),

  http.delete(`${base}/providers/:providerId`, ({ params }) => {
    const ok = providerStore.remove(String(params.providerId));
    if (!ok) {
      return HttpResponse.json({ detail: "Provider not found" }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${base}/providers/:providerId/test`, ({ params }) => {
    const provider = providerStore.get(String(params.providerId));
    if (!provider) {
      return HttpResponse.json({ detail: "Provider not found" }, { status: 404 });
    }
    // A keyless cloud provider fails the test; otherwise it passes (the real
    // backend pings the provider — here we mirror the ok/detail contract).
    const needsKey = provider.type !== "ollama";
    const ok = !needsKey || provider.has_key;
    return HttpResponse.json({
      ok,
      detail: ok ? "Kapcsolat rendben." : "Hiányzó API-kulcs.",
    });
  }),

  http.get(`${base}/providers/:providerId/models`, ({ params }) => {
    const provider = providerStore.get(String(params.providerId));
    if (!provider) {
      return HttpResponse.json({ detail: "Provider not found" }, { status: 404 });
    }
    return HttpResponse.json({
      models: [
        { id: `${provider.type}/model-a`, label: "Model A" },
        { id: `${provider.type}/model-b`, label: "Model B" },
      ],
    });
  }),

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

  /* ---- Export (Markdown — real endpoint, M8) ---- */
  http.post(`${base}/books/:bookId/exports`, ({ params }) => {
    if (params.bookId === FAROSZ_BOOK.id) {
      // Mirror the backend: text/markdown body + Content-Disposition with both
      // an ASCII filename and the RFC 5987 UTF-8 filename*.
      const body = `# ${FAROSZ_BOOK.title}\n\n## II. fejezet\n\nSzelene a tekercsek közé hajolt.\n`;
      return new HttpResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="a_farosz_orzoje.md"; ' +
            "filename*=UTF-8''A%20F%C3%A1rosz%20%C5%91rz%C5%91je.md",
        },
      });
    }
    return HttpResponse.json({ detail: "Book not found" }, { status: 404 });
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
