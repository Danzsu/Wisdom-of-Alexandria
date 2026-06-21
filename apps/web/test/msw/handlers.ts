/**
 * MSW request handlers for the Projects/Books + AI endpoints. Returns fixtures
 * that match the real schema shapes so tests exercise the same parse/validation
 * path as production.
 */
import { http, HttpResponse } from "msw";
import { AI_BASE_URL, API_BASE_URL } from "@/lib/api/client";
import {
  AI_GENERATED_TEXT,
  CHAPTERS_FIXTURE,
  FAROSZ_BOOK,
  FAROSZ_CODEX,
  FAROSZ_PROJECT,
  FAROSZ_RELATIONS,
  JOBS_FIXTURE,
  MODELS_FIXTURE,
  PLOTLINES_FIXTURE,
  PLOTLINE_SCENES_FIXTURE,
  PROJECTS_FIXTURE,
  PROVIDERS_FIXTURE,
  SCENE_BEATS_FIXTURE,
  SCENES_BY_CHAPTER,
  SERIES_FIXTURE,
  makeAiResult,
  makeChapter,
  makeCodexEntry,
  makeCodexRelation,
  makeContinuityResult,
  makeDescribeResult,
  makeIndexJob,
  makePlotline,
  makeResearchResult,
  makePlotlineScene,
  makeProvider,
  makeRevision,
  makeScene,
  makeSeries,
  makeSnippet,
  maskKey,
} from "./fixtures";
import type {
  BookRead,
  BookUpdate,
  ChapterCreate,
  ChapterRead,
  ChapterUpdate,
  CodexEntryCreate,
  CodexEntryRead,
  CodexEntryUpdate,
  CodexRelationCreate,
  CodexRelationRead,
  CodexRelationUpdate,
  PlotlineCreate,
  PlotlineRead,
  PlotlineSceneCreate,
  PlotlineSceneRead,
  PlotlineUpdate,
  ProjectRead,
  SceneCreate,
  SceneRead,
  SceneUpdate,
  SeriesCreate,
  SeriesRead,
  SeriesUpdate,
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

/** ASCII-fold a Hungarian title the way the backend filename logic does. */
function asciiFilename(title: string): string {
  const folded = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7e]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  return `${folded.length > 0 ? folded : "export"}.md`;
}

/**
 * Build a text/markdown download Response with a scope-appropriate
 * Content-Disposition (ASCII filename + RFC 5987 UTF-8 filename*), mirroring the
 * real backend export endpoint.
 */
function markdownDownload(body: string, title: string) {
  const ascii = asciiFilename(title);
  const utf8 = encodeURIComponent(`${title}.md`);
  return new HttpResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`,
    },
  });
}

/** Domain backend base — projects/books/chapters/scenes/codex/exports/revisions/
 * snippets. */
const base = `${API_BASE_URL}/api/v1`;
/**
 * AI service base — `/ai/*` + `/providers/*` (+ `/jobs`). After the Alexandria
 * split the frontend points these at `NEXT_PUBLIC_AI_URL`, so the matching MSW
 * handlers must register on this base too (revisions/snippets stay on `base`).
 */
const aiBase = `${AI_BASE_URL}/api/v1`;

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

  /**
   * Feature #3a — list under a SERIES scope: project-global entries
   * (`series_id === null`) PLUS the given series' entries. Mirrors the real
   * backend's `?series_id=<id>` filter.
   */
  listForSeries(projectId: string, seriesId: string): CodexEntryRead[] {
    return this.list(projectId).filter(
      (e) => e.series_id === null || e.series_id === seriesId,
    );
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
 * In-memory CodexRelation store (UX-3a) — stateful CRUD so the graph tests
 * exercise list → create → delete. Seeded from FAROSZ_RELATIONS. Call
 * `resetRelationStore()` in a test's beforeEach for isolation.
 * ------------------------------------------------------------------------- */
const relationStore = {
  byProject: new Map<string, CodexRelationRead[]>(),

  seed(): void {
    this.byProject = new Map<string, CodexRelationRead[]>();
    this.byProject.set(
      FAROSZ_PROJECT.id,
      FAROSZ_RELATIONS.map((r) => ({ ...r })),
    );
  },

  reset(): void {
    this.seed();
  },

  list(projectId: string): CodexRelationRead[] {
    return this.byProject.get(projectId) ?? [];
  },

  create(projectId: string, body: CodexRelationCreate): CodexRelationRead {
    const created = makeCodexRelation(projectId, body);
    const list = this.byProject.get(projectId) ?? [];
    list.push(created);
    this.byProject.set(projectId, list);
    return created;
  },

  update(
    projectId: string,
    relationId: string,
    patch: CodexRelationUpdate,
  ): CodexRelationRead | undefined {
    const list = this.byProject.get(projectId);
    if (!list) return undefined;
    const index = list.findIndex((r) => r.id === relationId);
    if (index === -1) return undefined;
    const merged: CodexRelationRead = {
      ...list[index],
      ...patch,
      updated_at: "2026-06-14T17:00:00Z",
    };
    list[index] = merged;
    return merged;
  },

  remove(projectId: string, relationId: string): boolean {
    const list = this.byProject.get(projectId);
    if (!list) return false;
    const index = list.findIndex((r) => r.id === relationId);
    if (index === -1) return false;
    list.splice(index, 1);
    return true;
  },
};
relationStore.seed();

/** Reset the in-memory CodexRelation store (call in a test's beforeEach). */
export function resetRelationStore(): void {
  relationStore.reset();
}

/* ---------------------------------------------------------------------------
 * In-memory Plotline store (Plotline-b Cselekményszálak) — stateful CRUD plus a
 * per-plotline scene-link store, so the screen tests exercise the real
 * list → create → attach → detach → delete round-trips. Seeded from
 * PLOTLINES_FIXTURE + PLOTLINE_SCENES_FIXTURE. The set of scenes that legally
 * belong to the (single) Fárosz project is the union of SCENES_BY_CHAPTER; an
 * attach of any other scene id is rejected 400 (mirrors the backend's
 * cross-project guard). Call `resetPlotlineStore()` in a test's beforeEach.
 * ------------------------------------------------------------------------- */
const plotlineStore = {
  byProject: new Map<string, PlotlineRead[]>(),
  // Scene links keyed by plotline id.
  scenesByPlotline: new Map<string, PlotlineSceneRead[]>(),
  // Scene ids that belong to the Fárosz project (for the cross-project guard).
  projectSceneIds: new Set<string>(),

  seed(): void {
    this.byProject = new Map<string, PlotlineRead[]>();
    this.byProject.set(
      FAROSZ_PROJECT.id,
      PLOTLINES_FIXTURE.map((p) => ({ ...p })),
    );
    this.scenesByPlotline = new Map<string, PlotlineSceneRead[]>();
    for (const [plotlineId, links] of Object.entries(
      PLOTLINE_SCENES_FIXTURE,
    )) {
      this.scenesByPlotline.set(
        plotlineId,
        links.map((l) => ({ ...l })),
      );
    }
    this.projectSceneIds = new Set<string>();
    for (const scenes of Object.values(SCENES_BY_CHAPTER)) {
      for (const scene of scenes) this.projectSceneIds.add(scene.id);
    }
  },

  reset(): void {
    this.seed();
  },

  list(projectId: string): PlotlineRead[] {
    return [...(this.byProject.get(projectId) ?? [])].sort(
      (a, b) => a.order_index - b.order_index,
    );
  },

  ownerProjectOf(plotlineId: string): string | undefined {
    for (const [projectId, list] of this.byProject.entries()) {
      if (list.some((p) => p.id === plotlineId)) return projectId;
    }
    return undefined;
  },

  create(projectId: string, body: PlotlineCreate): PlotlineRead {
    const created = makePlotline(projectId, body);
    const list = this.byProject.get(projectId) ?? [];
    list.push(created);
    this.byProject.set(projectId, list);
    this.scenesByPlotline.set(created.id, []);
    return created;
  },

  update(
    projectId: string,
    plotlineId: string,
    patch: PlotlineUpdate,
  ): PlotlineRead | undefined {
    const list = this.byProject.get(projectId);
    if (!list) return undefined;
    const index = list.findIndex((p) => p.id === plotlineId);
    if (index === -1) return undefined;
    const merged: PlotlineRead = {
      ...list[index],
      ...patch,
      updated_at: "2026-06-21T12:00:00Z",
    };
    list[index] = merged;
    return merged;
  },

  remove(projectId: string, plotlineId: string): boolean {
    const list = this.byProject.get(projectId);
    if (!list) return false;
    const index = list.findIndex((p) => p.id === plotlineId);
    if (index === -1) return false;
    list.splice(index, 1);
    this.scenesByPlotline.delete(plotlineId);
    return true;
  },

  listScenes(plotlineId: string): PlotlineSceneRead[] {
    return [...(this.scenesByPlotline.get(plotlineId) ?? [])].sort(
      (a, b) => a.order_index - b.order_index,
    );
  },

  /** True when a scene id does NOT belong to the plotline's project. */
  isCrossProjectScene(sceneId: string): boolean {
    return !this.projectSceneIds.has(sceneId);
  },

  attachScene(
    plotlineId: string,
    body: PlotlineSceneCreate,
  ): PlotlineSceneRead {
    const created = makePlotlineScene(plotlineId, body);
    const links = this.scenesByPlotline.get(plotlineId) ?? [];
    links.push(created);
    this.scenesByPlotline.set(plotlineId, links);
    return created;
  },

  detachScene(plotlineId: string, sceneId: string): boolean {
    const links = this.scenesByPlotline.get(plotlineId);
    if (!links) return false;
    const index = links.findIndex((l) => l.scene_id === sceneId);
    if (index === -1) return false;
    links.splice(index, 1);
    return true;
  },
};
plotlineStore.seed();

/** Reset the in-memory Plotline store (call in a test's beforeEach). */
export function resetPlotlineStore(): void {
  plotlineStore.reset();
}

/* ---------------------------------------------------------------------------
 * In-memory Series store (Feature #3a) — stateful CRUD so the series-management
 * + scope tests exercise list → create → rename → delete. Seeded from
 * SERIES_FIXTURE. Call `resetSeriesStore()` in a test's beforeEach.
 * ------------------------------------------------------------------------- */
const seriesStore = {
  byProject: new Map<string, SeriesRead[]>(),

  seed(): void {
    this.byProject = new Map<string, SeriesRead[]>();
    this.byProject.set(
      FAROSZ_PROJECT.id,
      SERIES_FIXTURE.map((s) => ({ ...s })),
    );
  },

  reset(): void {
    this.seed();
  },

  list(projectId: string): SeriesRead[] {
    return [...(this.byProject.get(projectId) ?? [])].sort(
      (a, b) => a.order_index - b.order_index,
    );
  },

  get(projectId: string, seriesId: string): SeriesRead | undefined {
    return (this.byProject.get(projectId) ?? []).find((s) => s.id === seriesId);
  },

  /** Does this series id exist in ANY project? (for the cross-project check) */
  ownerProjectOf(seriesId: string): string | undefined {
    for (const [projectId, list] of this.byProject.entries()) {
      if (list.some((s) => s.id === seriesId)) return projectId;
    }
    return undefined;
  },

  create(projectId: string, body: SeriesCreate): SeriesRead {
    const created = makeSeries(projectId, body);
    const list = this.byProject.get(projectId) ?? [];
    list.push(created);
    this.byProject.set(projectId, list);
    return created;
  },

  update(
    projectId: string,
    seriesId: string,
    patch: SeriesUpdate,
  ): SeriesRead | undefined {
    const list = this.byProject.get(projectId);
    if (!list) return undefined;
    const index = list.findIndex((s) => s.id === seriesId);
    if (index === -1) return undefined;
    const merged: SeriesRead = {
      ...list[index],
      ...patch,
      updated_at: "2026-06-16T12:00:00Z",
    };
    list[index] = merged;
    return merged;
  },

  remove(projectId: string, seriesId: string): boolean {
    const list = this.byProject.get(projectId);
    if (!list) return false;
    const index = list.findIndex((s) => s.id === seriesId);
    if (index === -1) return false;
    list.splice(index, 1);
    return true;
  },
};
seriesStore.seed();

/** Reset the in-memory Series store (call in a test's beforeEach). */
export function resetSeriesStore(): void {
  seriesStore.reset();
}

/* ---------------------------------------------------------------------------
 * In-memory Book store (Feature #3a) — only the Fárosz book, kept stateful so a
 * PATCH /books/{id} (e.g. assigning a series_id) is reflected in the subsequent
 * GET list (`resolveBookById` re-reads it). Call `resetBookStore()` in beforeEach.
 * ------------------------------------------------------------------------- */
const bookStore = {
  byProject: new Map<string, BookRead[]>(),

  seed(): void {
    this.byProject = new Map<string, BookRead[]>();
    this.byProject.set(FAROSZ_PROJECT.id, [{ ...FAROSZ_BOOK }]);
  },

  reset(): void {
    this.seed();
  },

  list(projectId: string): BookRead[] {
    return this.byProject.get(projectId) ?? [];
  },

  update(
    projectId: string,
    bookId: string,
    patch: BookUpdate,
  ): BookRead | undefined {
    const list = this.byProject.get(projectId);
    if (!list) return undefined;
    const index = list.findIndex((b) => b.id === bookId);
    if (index === -1) return undefined;
    const merged: BookRead = {
      ...list[index],
      ...patch,
      updated_at: "2026-06-16T12:00:00Z",
    };
    list[index] = merged;
    return merged;
  },
};
bookStore.seed();

/** Reset the in-memory Book store (call in a test's beforeEach). */
export function resetBookStore(): void {
  bookStore.reset();
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

  /** Find the chapter id that currently owns a scene (any chapter). */
  findSceneChapter(sceneId: string): string | undefined {
    for (const [chapterId, scenes] of this.scenesByChapter.entries()) {
      if (scenes.some((s) => s.id === sceneId)) return chapterId;
    }
    return undefined;
  },

  /** Find the book id that owns a chapter (for the same-book move check). */
  findChapterBook(chapterId: string): string | undefined {
    for (const [bookId, chapters] of this.chaptersByBook.entries()) {
      if (chapters.some((c) => c.id === chapterId)) return bookId;
    }
    return undefined;
  },

  /**
   * Move a scene to another chapter at `targetIndex`, densely renumbering BOTH
   * chapters (mirrors the backend). Returns a result discriminating the failure
   * modes the real endpoint enforces: scene/target-chapter not found, or a
   * cross-book move. On success returns the moved scene.
   */
  moveScene(
    sceneId: string,
    targetChapterId: string,
    targetIndex: number,
  ):
    | { ok: true; scene: SceneRead }
    | { ok: false; status: 404 | 400 } {
    const sourceChapterId = this.findSceneChapter(sceneId);
    if (sourceChapterId === undefined) return { ok: false, status: 404 };
    const targetBook = this.findChapterBook(targetChapterId);
    if (targetBook === undefined) return { ok: false, status: 404 };
    const sourceBook = this.findChapterBook(sourceChapterId);
    if (sourceBook !== targetBook) return { ok: false, status: 400 };

    const sourceList = this.scenesByChapter.get(sourceChapterId) ?? [];
    const scene = sourceList.find((s) => s.id === sceneId)!;

    const denselyRenumber = (scenes: SceneRead[]): void => {
      scenes.forEach((s, i) => {
        s.order_index = i;
      });
    };

    if (sourceChapterId === targetChapterId) {
      const remaining = sourceList.filter((s) => s.id !== sceneId);
      const idx = Math.max(0, Math.min(targetIndex, remaining.length));
      remaining.splice(idx, 0, scene);
      denselyRenumber(remaining);
      this.scenesByChapter.set(sourceChapterId, remaining);
      return { ok: true, scene };
    }

    const newSource = sourceList.filter((s) => s.id !== sceneId);
    denselyRenumber(newSource);
    this.scenesByChapter.set(sourceChapterId, newSource);

    const targetList = this.scenesByChapter.get(targetChapterId) ?? [];
    scene.chapter_id = targetChapterId;
    const idx = Math.max(0, Math.min(targetIndex, targetList.length));
    targetList.splice(idx, 0, scene);
    denselyRenumber(targetList);
    this.scenesByChapter.set(targetChapterId, targetList);

    return { ok: true, scene };
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
    // A brand-new project has no books or scenes yet (mirrors the backend).
    book_count: 0,
    word_count: 0,
  };
}

/** Build a `BookRead` echo for a POST /projects/{pid}/books body. */
function makeBook(projectId: string, body: Partial<BookRead>): BookRead {
  const now = "2026-06-14T15:00:00Z";
  return {
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    project_id: projectId,
    series_id: body.series_id ?? null,
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
    // Served from the stateful book store so a PATCH (series assignment) shows
    // up on the next read.
    return HttpResponse.json(bookStore.list(String(params.projectId)));
  }),

  http.post(`${base}/projects/:projectId/books`, async ({ params, request }) => {
    const body = (await request.json()) as Partial<BookRead>;
    return HttpResponse.json(makeBook(String(params.projectId), body), {
      status: 201,
    });
  }),

  /* ---- Book update (PATCH — Feature #3a series assignment) ----
   * Mirrors the backend: a `series_id` pointing at a series in a DIFFERENT
   * project is rejected with 400; a series in this project (or null) is accepted.
   */
  http.patch(
    `${base}/projects/:projectId/books/:bookId`,
    async ({ params, request }) => {
      const projectId = String(params.projectId);
      const body = (await request.json()) as BookUpdate;
      if (
        body.series_id !== undefined &&
        body.series_id !== null &&
        seriesStore.ownerProjectOf(body.series_id) !== projectId
      ) {
        return HttpResponse.json(
          { detail: "A sorozat egy másik projekthez tartozik." },
          { status: 400 },
        );
      }
      const updated = bookStore.update(projectId, String(params.bookId), body);
      if (!updated) {
        return HttpResponse.json({ detail: "Book not found" }, { status: 404 });
      }
      return HttpResponse.json(updated);
    },
  ),

  /* ---- Series (project-scoped, full CRUD — Feature #3a) ---- */
  http.get(`${base}/projects/:projectId/series`, ({ params }) =>
    HttpResponse.json(seriesStore.list(String(params.projectId))),
  ),

  http.get(`${base}/projects/:projectId/series/:seriesId`, ({ params }) => {
    const series = seriesStore.get(
      String(params.projectId),
      String(params.seriesId),
    );
    if (!series) {
      return HttpResponse.json({ detail: "Series not found" }, { status: 404 });
    }
    return HttpResponse.json(series);
  }),

  http.post(
    `${base}/projects/:projectId/series`,
    async ({ params, request }) => {
      const body = (await request.json()) as SeriesCreate;
      const created = seriesStore.create(String(params.projectId), body);
      return HttpResponse.json(created, { status: 201 });
    },
  ),

  http.patch(
    `${base}/projects/:projectId/series/:seriesId`,
    async ({ params, request }) => {
      const body = (await request.json()) as SeriesUpdate;
      const updated = seriesStore.update(
        String(params.projectId),
        String(params.seriesId),
        body,
      );
      if (!updated) {
        return HttpResponse.json(
          { detail: "Series not found" },
          { status: 404 },
        );
      }
      return HttpResponse.json(updated);
    },
  ),

  http.delete(`${base}/projects/:projectId/series/:seriesId`, ({ params }) => {
    const ok = seriesStore.remove(
      String(params.projectId),
      String(params.seriesId),
    );
    if (!ok) {
      return HttpResponse.json({ detail: "Series not found" }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  /* ---- DOCX import (#2b) ----
   * NOTE: `request.formData()` is unreliable in the jsdom + undici test stack,
   * so we read the title from the raw multipart text instead of parsing it.
   */
  http.post(
    `${base}/projects/:projectId/imports`,
    async ({ request }) => {
      const body = await request.text();
      const match = body.match(
        /name="title"\r?\n\r?\n([\s\S]*?)\r?\n--/,
      );
      const title = match?.[1]?.trim() || "Importált könyv";
      return HttpResponse.json(
        {
          book_id: "imported-book-1",
          title,
          chapter_count: 2,
          scene_count: 3,
          word_count: 9,
        },
        { status: 201 },
      );
    },
  ),

  /* ---- Project JSON backup / restore (Feature #5) ---- */
  // GET backup: returns the JSON envelope with a download Content-Disposition.
  http.get(`${base}/projects/:projectId/backup`, ({ params }) => {
    const envelope = {
      version: 1,
      exported_at: "2026-06-16T00:00:00+00:00",
      project: {
        id: String(params.projectId),
        title: "Mentett projekt",
        description: null,
        language: "hu",
      },
      series: [],
      books: [],
      chapters: [],
      scenes: [],
      beats: [],
      codex_entries: [],
      characters: [],
      locations: [],
      worldbuilding_entries: [],
      snippets: [],
      style_guides: [],
      codex_relations: [],
      codex_progressions: [],
    };
    return HttpResponse.json(envelope, {
      headers: {
        "Content-Disposition":
          'attachment; filename="mentett_projekt-backup.json"',
      },
    });
  }),
  // POST restore: multipart .json upload → new project summary (201).
  http.post(`${base}/projects/restore`, async ({ request }) => {
    // Read the multipart body; a backup whose embedded title is "BAD" simulates
    // a 422 (malformed/unsupported), exercising the error path.
    const body = await request.text();
    if (body.includes('"version": 999') || body.includes('"version":999')) {
      return HttpResponse.json(
        { detail: "Unsupported backup version: 999 (this server supports version 1)." },
        { status: 422 },
      );
    }
    return HttpResponse.json(
      {
        project_id: "restored-project-1",
        title: "Visszaállított projekt",
        series_count: 1,
        book_count: 2,
        chapter_count: 1,
        scene_count: 1,
        beat_count: 1,
        codex_entry_count: 1,
        character_count: 1,
        location_count: 0,
        worldbuilding_count: 0,
        snippet_count: 0,
        style_guide_count: 0,
        codex_relation_count: 1,
        codex_progression_count: 1,
      },
      { status: 201 },
    );
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

  /* ---- Scene move (cross-chapter — P1.5, top-level action) ---- */
  http.post(`${base}/scenes/:sceneId/move`, async ({ params, request }) => {
    const body = (await request.json()) as {
      chapter_id: string;
      order_index: number;
    };
    const result = planStore.moveScene(
      String(params.sceneId),
      body.chapter_id,
      body.order_index,
    );
    if (!result.ok) {
      const detail =
        result.status === 400
          ? "Target chapter belongs to a different book"
          : "Scene not found";
      return HttpResponse.json({ detail }, { status: result.status });
    }
    return HttpResponse.json(result.scene);
  }),

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

  /* ---- Codex (project-scoped, full CRUD — M6; series scope — #3a) ---- */
  http.get(`${base}/projects/:projectId/codex`, ({ params, request }) => {
    const projectId = String(params.projectId);
    const seriesId = new URL(request.url).searchParams.get("series_id");
    // `?series_id=<id>` → project-global + that series; omitted → all entries.
    const entries =
      seriesId === null
        ? codexStore.list(projectId)
        : codexStore.listForSeries(projectId, seriesId);
    return HttpResponse.json(entries);
  }),

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

  /* ---- CodexRelations (UX-3a relationship graph). Project-scoped CRUD. ---- */
  http.get(`${base}/projects/:projectId/codex-relations`, ({ params }) =>
    HttpResponse.json(relationStore.list(String(params.projectId))),
  ),

  http.post(
    `${base}/projects/:projectId/codex-relations`,
    async ({ params, request }) => {
      const body = (await request.json()) as CodexRelationCreate;
      const created = relationStore.create(String(params.projectId), body);
      return HttpResponse.json(created, { status: 201 });
    },
  ),

  http.patch(
    `${base}/projects/:projectId/codex-relations/:relationId`,
    async ({ params, request }) => {
      const body = (await request.json()) as CodexRelationUpdate;
      const updated = relationStore.update(
        String(params.projectId),
        String(params.relationId),
        body,
      );
      if (!updated) {
        return HttpResponse.json(
          { detail: "Relation not found" },
          { status: 404 },
        );
      }
      return HttpResponse.json(updated);
    },
  ),

  http.delete(
    `${base}/projects/:projectId/codex-relations/:relationId`,
    ({ params }) => {
      const ok = relationStore.remove(
        String(params.projectId),
        String(params.relationId),
      );
      if (!ok) {
        return HttpResponse.json(
          { detail: "Relation not found" },
          { status: 404 },
        );
      }
      return new HttpResponse(null, { status: 204 });
    },
  ),

  /* ---- Plotlines (Plotline-b Cselekményszálak). Project-scoped CRUD + a flat
   * scene-link router (attach/detach/list). ---- */
  http.get(`${base}/projects/:projectId/plotlines`, ({ params }) =>
    HttpResponse.json(plotlineStore.list(String(params.projectId))),
  ),

  http.post(
    `${base}/projects/:projectId/plotlines`,
    async ({ params, request }) => {
      const body = (await request.json()) as PlotlineCreate;
      const created = plotlineStore.create(String(params.projectId), body);
      return HttpResponse.json(created, { status: 201 });
    },
  ),

  http.patch(
    `${base}/projects/:projectId/plotlines/:plotlineId`,
    async ({ params, request }) => {
      const body = (await request.json()) as PlotlineUpdate;
      const updated = plotlineStore.update(
        String(params.projectId),
        String(params.plotlineId),
        body,
      );
      if (!updated) {
        return HttpResponse.json(
          { detail: "Plotline not found" },
          { status: 404 },
        );
      }
      return HttpResponse.json(updated);
    },
  ),

  http.delete(
    `${base}/projects/:projectId/plotlines/:plotlineId`,
    ({ params }) => {
      const ok = plotlineStore.remove(
        String(params.projectId),
        String(params.plotlineId),
      );
      if (!ok) {
        return HttpResponse.json(
          { detail: "Plotline not found" },
          { status: 404 },
        );
      }
      return new HttpResponse(null, { status: 204 });
    },
  ),

  /* ---- Plotline ↔ scene links (flat router; no project prefix). ---- */
  http.get(`${base}/plotlines/:plotlineId/scenes`, ({ params }) => {
    const plotlineId = String(params.plotlineId);
    if (!plotlineStore.ownerProjectOf(plotlineId)) {
      return HttpResponse.json({ detail: "Plotline not found" }, { status: 404 });
    }
    return HttpResponse.json(plotlineStore.listScenes(plotlineId));
  }),

  http.post(
    `${base}/plotlines/:plotlineId/scenes`,
    async ({ params, request }) => {
      const plotlineId = String(params.plotlineId);
      if (!plotlineStore.ownerProjectOf(plotlineId)) {
        return HttpResponse.json(
          { detail: "Plotline not found" },
          { status: 404 },
        );
      }
      const body = (await request.json()) as PlotlineSceneCreate;
      // Cross-project scene → 400 (mirrors the backend's scope guard).
      if (plotlineStore.isCrossProjectScene(body.scene_id)) {
        return HttpResponse.json(
          { detail: "Scene belongs to a different project" },
          { status: 400 },
        );
      }
      const created = plotlineStore.attachScene(plotlineId, body);
      return HttpResponse.json(created, { status: 201 });
    },
  ),

  http.delete(
    `${base}/plotlines/:plotlineId/scenes/:sceneId`,
    ({ params }) => {
      const ok = plotlineStore.detachScene(
        String(params.plotlineId),
        String(params.sceneId),
      );
      if (!ok) {
        return HttpResponse.json(
          { detail: "Scene is not attached to this plotline" },
          { status: 404 },
        );
      }
      return new HttpResponse(null, { status: 204 });
    },
  ),

  /* ---- Providers (P1.1 — full CRUD + test + models, masked reads).
   * On the AI service base (`aiBase`) after the Alexandria split. ---- */
  http.get(`${aiBase}/providers`, ({ request }) => {
    const enabledOnly =
      new URL(request.url).searchParams.get("enabled_only") === "true";
    return HttpResponse.json(providerStore.list(enabledOnly));
  }),

  http.get(`${aiBase}/providers/:providerId`, ({ params }) => {
    const provider = providerStore.get(String(params.providerId));
    if (!provider) {
      return HttpResponse.json({ detail: "Provider not found" }, { status: 404 });
    }
    return HttpResponse.json(provider);
  }),

  http.post(`${aiBase}/providers`, async ({ request }) => {
    const body = (await request.json()) as ProviderCreate;
    return HttpResponse.json(providerStore.create(body), { status: 201 });
  }),

  http.patch(`${aiBase}/providers/:providerId`, async ({ params, request }) => {
    const body = (await request.json()) as ProviderUpdate;
    const updated = providerStore.update(String(params.providerId), body);
    if (!updated) {
      return HttpResponse.json({ detail: "Provider not found" }, { status: 404 });
    }
    return HttpResponse.json(updated);
  }),

  http.delete(`${aiBase}/providers/:providerId`, ({ params }) => {
    const ok = providerStore.remove(String(params.providerId));
    if (!ok) {
      return HttpResponse.json({ detail: "Provider not found" }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${aiBase}/providers/:providerId/test`, ({ params }) => {
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

  http.get(`${aiBase}/providers/:providerId/models`, ({ params }) => {
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

  /* ---- Export (Markdown — real endpoint, scope: book/chapter/scene — P1.3) ---- */
  http.post(`${base}/books/:bookId/exports`, ({ params, request }) => {
    if (params.bookId !== FAROSZ_BOOK.id) {
      return HttpResponse.json({ detail: "Book not found" }, { status: 404 });
    }
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") ?? "book";
    const targetId = url.searchParams.get("target_id");

    // Mirror the backend: text/markdown body + Content-Disposition with both an
    // ASCII filename and the RFC 5987 UTF-8 filename*, scoped per the request.
    if (scope === "chapter") {
      if (!targetId) {
        return HttpResponse.json(
          { detail: "target_id is required for chapter/scene scope" },
          { status: 422 },
        );
      }
      const chapter = CHAPTERS_FIXTURE.find((c) => c.id === targetId);
      if (!chapter) {
        return HttpResponse.json({ detail: "Chapter not found" }, { status: 404 });
      }
      return markdownDownload(`## 1. ${chapter.title}\n`, chapter.title);
    }

    if (scope === "scene") {
      if (!targetId) {
        return HttpResponse.json(
          { detail: "target_id is required for chapter/scene scope" },
          { status: 422 },
        );
      }
      const scene = Object.values(SCENES_BY_CHAPTER)
        .flat()
        .find((s) => s.id === targetId);
      if (!scene) {
        return HttpResponse.json({ detail: "Scene not found" }, { status: 404 });
      }
      return markdownDownload(
        `### 1.1 ${scene.title}\n\n${scene.content ?? ""}\n`,
        scene.title,
      );
    }

    return markdownDownload(
      `# ${FAROSZ_BOOK.title}\n\n## II. fejezet\n\nSzelene a tekercsek közé hajolt.\n`,
      FAROSZ_BOOK.title,
    );
  }),

  /* ---- AI (config-driven models + generation). On the AI service base
   * (`aiBase`) after the Alexandria split. ---- */
  http.get(`${aiBase}/ai/models`, () => HttpResponse.json(MODELS_FIXTURE)),

  http.post(`${aiBase}/ai/rewrite`, async ({ request }) => {
    const body = (await request.json()) as { model?: string | null };
    const model = body.model ?? MODELS_FIXTURE.default;
    return HttpResponse.json(makeAiResult("rewrite", AI_GENERATED_TEXT, model));
  }),

  http.post(`${aiBase}/ai/write-continue`, async ({ request }) => {
    const body = (await request.json()) as { model?: string | null };
    const model = body.model ?? MODELS_FIXTURE.default;
    return HttpResponse.json(
      makeAiResult("write_continue", AI_GENERATED_TEXT, model),
    );
  }),

  http.post(`${aiBase}/ai/generate-scene`, async ({ request }) => {
    const body = (await request.json()) as { model?: string | null };
    const model = body.model ?? MODELS_FIXTURE.default;
    return HttpResponse.json(
      makeAiResult("generate_scene", AI_GENERATED_TEXT, model),
    );
  }),

  http.post(`${aiBase}/ai/describe`, async ({ request }) => {
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

  /* ---- Continuity check (B3 — structured warnings, no revision). On the AI
   * service base (`aiBase`). Returns the mixed-severity fixture by default;
   * tests override this handler to exercise the empty / error / malformed
   * paths. ---- */
  http.post(`${aiBase}/ai/continuity`, () =>
    HttpResponse.json(makeContinuityResult()),
  ),

  /* ---- Research (Codex/manuscript RAG Q&A, P2). Default returns a grounded
   * answer + one citation chip; tests override for the no-context / error
   * paths via server.use(...). ---- */
  http.post(`${aiBase}/ai/research`, () =>
    HttpResponse.json(makeResearchResult()),
  ),

  /* ---- Generation jobs (B1 — live AI-feladatok screen + nav badge). On the
   * AI service base (`aiBase`). Mirrors the real backend: book-scoped, optional
   * status filter, bounded limit, newest-first. ---- */
  http.get(`${aiBase}/jobs`, ({ request }) => {
    const url = new URL(request.url);
    const bookId = url.searchParams.get("book_id");
    const statusFilter = url.searchParams.get("status");
    const limitParam = url.searchParams.get("limit");
    // Only the Fárosz book has seeded jobs; any other book is empty (mirrors a
    // real book-scoped query returning nothing for an unrelated book).
    let jobs = bookId === FAROSZ_BOOK.id ? [...JOBS_FIXTURE] : [];
    if (statusFilter) {
      jobs = jobs.filter((j) => j.status === statusFilter);
    }
    if (limitParam) {
      const limit = Number(limitParam);
      if (Number.isFinite(limit)) jobs = jobs.slice(0, limit);
    }
    return HttpResponse.json(jobs);
  }),

  http.delete(`${aiBase}/jobs/:jobId`, ({ params }) => {
    const exists = JOBS_FIXTURE.some((j) => j.id === String(params.jobId));
    if (!exists) {
      return HttpResponse.json({ detail: "Job not found" }, { status: 404 });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  /* ---- Async RAG index (P1L-1). POST enqueues a pending INDEX job; GET
   * /jobs/{id} polls it. The default GET returns a DONE index job with counts so
   * a basic rebuild flow resolves; tests override with `server.use(...)` to
   * exercise the running / no-provider / failed paths. ---- */
  http.post(`${aiBase}/ai/index/async`, () =>
    HttpResponse.json(makeIndexJob("pending"), { status: 202 }),
  ),

  http.get(`${aiBase}/jobs/:jobId`, ({ params }) =>
    HttpResponse.json(
      makeIndexJob(
        "done",
        { indexed: 3, updated: 1, deleted: 0, skipped: 2, skipped_no_provider: false },
        String(params.jobId),
      ),
    ),
  ),

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
