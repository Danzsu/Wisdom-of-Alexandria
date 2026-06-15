"use client";

/**
 * TanStack Query hooks for the Projects/Books/Chapters/Scenes/Codex resources.
 *
 * Project↔Book mapping: a Book belongs to a Project (`/projects/{pid}/books`).
 * The New-book wizard therefore creates a Project first, then a Book under it —
 * see {@link useCreateBookWithProject}. Errors propagate to the UI via Query's
 * `error` / `isError` (never swallowed); mutations invalidate the relevant
 * caches on success.
 *
 * Chapter→Scene mapping (M4 Write View): chapters are book-scoped
 * (`/books/{bid}/chapters`) and scenes are chapter-scoped
 * (`/chapters/{cid}/scenes`). The Write route only carries `bookId` + `sceneId`,
 * so {@link useBookTree} loads the whole chapter+scene tree for a book, and
 * {@link findSceneLocation} resolves which chapter owns a given scene id within
 * that loaded tree.
 */
import { useCallback } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { createProject, getProject, listProjects } from "./projects";
import { createBook, listBooks } from "./books";
import {
  createChapter,
  deleteChapter,
  listChapters,
  reorderChapters,
  updateChapter,
} from "./chapters";
import {
  archiveScene,
  createScene,
  deleteScene,
  listScenes,
  moveScene,
  reorderScenes,
  updateScene,
} from "./scenes";
import { createBeat, listBeats } from "./beats";
import {
  createCodexEntry,
  deleteCodexEntry,
  getCodexEntry,
  listCodexEntries,
  updateCodexEntry,
} from "./codex";
import type {
  BeatCreate,
  BeatRead,
  BookCreate,
  BookRead,
  ChapterCreate,
  ChapterRead,
  ChapterUpdate,
  CodexEntryCreate,
  CodexEntryRead,
  CodexEntryUpdate,
  ProjectCreate,
  ProjectRead,
  SceneCreate,
  SceneRead,
  SceneUpdate,
} from "./types";

/** Stable query-key factory — keeps cache keys consistent across the app. */
export const queryKeys = {
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  projectBooks: (projectId: string) =>
    ["projects", projectId, "books"] as const,
  projectCodex: (projectId: string) =>
    ["projects", projectId, "codex"] as const,
  codexEntry: (projectId: string, entryId: string) =>
    ["projects", projectId, "codex", entryId] as const,
  bookChapters: (bookId: string) => ["books", bookId, "chapters"] as const,
  chapterScenes: (chapterId: string) =>
    ["chapters", chapterId, "scenes"] as const,
  scene: (chapterId: string, sceneId: string) =>
    ["chapters", chapterId, "scenes", sceneId] as const,
  sceneBeats: (sceneId: string) => ["scenes", sceneId, "beats"] as const,
};

/** List every project. */
export function useProjects(): UseQueryResult<ProjectRead[], Error> {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => listProjects(),
  });
}

/** Fetch a single project by id. Disabled until an id is supplied. */
export function useProject(
  id: string | undefined,
): UseQueryResult<ProjectRead, Error> {
  return useQuery({
    queryKey: queryKeys.project(id ?? "__none__"),
    queryFn: () => getProject(id as string),
    enabled: Boolean(id),
  });
}

/** List the books of a project. Disabled until a project id is supplied. */
export function useProjectBooks(
  projectId: string | undefined,
): UseQueryResult<BookRead[], Error> {
  return useQuery({
    queryKey: queryKeys.projectBooks(projectId ?? "__none__"),
    queryFn: () => listBooks(projectId as string),
    enabled: Boolean(projectId),
  });
}

/**
 * Resolve a project's first book id, fetching (and caching) the book list via
 * the query client. Returns the first book's id, or null when the project has no
 * book yet. Throws on a fetch/parse error so callers can surface it (never
 * swallowed). Used by the dashboard to open a project at its real BOOK route —
 * a project owns many books, so its own id must never be used as a `[bookId]`.
 */
export function useResolveFirstBookId(): (
  projectId: string,
) => Promise<string | null> {
  const queryClient = useQueryClient();
  return useCallback(
    async (projectId: string) => {
      const books = await queryClient.fetchQuery({
        queryKey: queryKeys.projectBooks(projectId),
        queryFn: () => listBooks(projectId),
      });
      return books[0]?.id ?? null;
    },
    [queryClient],
  );
}

/** Create a standalone project (invalidates the project list on success). */
export function useCreateProject(): UseMutationResult<
  ProjectRead,
  Error,
  ProjectCreate
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectCreate) => createProject(input),
    onSuccess: () => {
      // Awaiting inside onSuccess is supported by Query; returning the promise
      // lets the mutation stay "pending" until the cache settles.
      return queryClient.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

/** Inputs for the combined project+book creation used by the wizard. */
export interface CreateBookWithProjectInput {
  project: ProjectCreate;
  book: BookCreate;
}

/**
 * Create a Project then a Book under it — the wizard's submit path, faithful to
 * the nested backend contract. Returns the created `BookRead` (its `id` drives
 * the post-submit navigation). On success both the project list and the new
 * project's book list are invalidated.
 */
export function useCreateBookWithProject(): UseMutationResult<
  BookRead,
  Error,
  CreateBookWithProjectInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ project, book }: CreateBookWithProjectInput) => {
      const createdProject = await createProject(project);
      return createBook(createdProject.id, book);
    },
    onSuccess: async (createdBook) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.projects });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.projectBooks(createdBook.project_id),
      });
    },
  });
}

/* ---------------------------------------------------------------------------
 * Chapters + scenes (M4 Write View)
 * ------------------------------------------------------------------------- */

/** List the chapters of a book. Disabled until a book id is supplied. */
export function useBookChapters(
  bookId: string | undefined,
): UseQueryResult<ChapterRead[], Error> {
  return useQuery({
    queryKey: queryKeys.bookChapters(bookId ?? "__none__"),
    queryFn: () => listChapters(bookId as string),
    enabled: Boolean(bookId),
  });
}

/** List the scenes of a chapter. Disabled until a chapter id is supplied. */
export function useChapterScenes(
  chapterId: string | undefined,
): UseQueryResult<SceneRead[], Error> {
  return useQuery({
    queryKey: queryKeys.chapterScenes(chapterId ?? "__none__"),
    queryFn: () => listScenes(chapterId as string),
    enabled: Boolean(chapterId),
  });
}

/** A chapter with its scenes resolved — the shape the ChapterTree renders. */
export interface ChapterWithScenes extends ChapterRead {
  scenes: SceneRead[];
}

/** Result of {@link useBookTree}: chapters with their scenes, loading + error. */
export interface BookTreeResult {
  /** Chapters (with scenes) once every per-chapter scene query has settled. */
  chapters: ChapterWithScenes[];
  isLoading: boolean;
  isError: boolean;
  /** The first error encountered across the chapter / scene queries, if any. */
  error: Error | null;
}

/**
 * Load the full chapter+scene tree for a book in one hook. Fetches the chapters,
 * then fans out one scenes query per chapter via `useQueries`. Any error (the
 * chapters list or a scene list) is surfaced through `error` / `isError` and
 * never swallowed.
 */
export function useBookTree(bookId: string | undefined): BookTreeResult {
  const chaptersQuery = useBookChapters(bookId);
  const chapters = chaptersQuery.data ?? [];

  const sceneQueries = useQueries({
    queries: chapters.map((chapter) => ({
      queryKey: queryKeys.chapterScenes(chapter.id),
      queryFn: () => listScenes(chapter.id),
      enabled: Boolean(bookId),
    })),
  });

  const scenesLoading = sceneQueries.some((q) => q.isLoading);
  const sceneError = sceneQueries.find((q) => q.error)?.error ?? null;

  const withScenes: ChapterWithScenes[] = chapters.map((chapter, index) => ({
    ...chapter,
    scenes: sceneQueries[index]?.data ?? [],
  }));

  return {
    chapters: withScenes,
    isLoading: chaptersQuery.isLoading || (chapters.length > 0 && scenesLoading),
    isError: chaptersQuery.isError || sceneQueries.some((q) => q.isError),
    error: chaptersQuery.error ?? (sceneError as Error | null),
  };
}

/** Locate which chapter owns a scene id within a loaded book tree. */
export function findSceneLocation(
  tree: ChapterWithScenes[],
  sceneId: string,
): { chapter: ChapterWithScenes; scene: SceneRead } | null {
  for (const chapter of tree) {
    const scene = chapter.scenes.find((s) => s.id === sceneId);
    if (scene) return { chapter, scene };
  }
  return null;
}

/**
 * Mutation that patches a scene's content (+ title/etc.). The backend recomputes
 * `word_count`. On success the scene + its chapter's scene list are updated in
 * the cache so the tree and StatusBar reflect the new word count without a
 * refetch. Errors propagate via the mutation's `error` (never swallowed).
 */
export interface UpdateSceneInput {
  chapterId: string;
  sceneId: string;
  patch: SceneUpdate;
}

export function useUpdateScene(): UseMutationResult<
  SceneRead,
  Error,
  UpdateSceneInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chapterId, sceneId, patch }: UpdateSceneInput) =>
      updateScene(chapterId, sceneId, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        queryKeys.scene(updated.chapter_id, updated.id),
        updated,
      );
      queryClient.setQueryData<SceneRead[]>(
        queryKeys.chapterScenes(updated.chapter_id),
        (prev) =>
          prev
            ? prev.map((s) => (s.id === updated.id ? updated : s))
            : prev,
      );
    },
  });
}

/* ---------------------------------------------------------------------------
 * order_index derivation for appends (M7 create)
 *
 * The backend create endpoints STORE the `order_index` they are sent (schema
 * default 0); they do NOT auto-append. To append at the end we must compute the
 * next index ourselves. Reading a captured render value (`.length`) is unsafe:
 * two rapid creates fired before the invalidation refetch land would compute the
 * SAME index → an order_index collision. Instead we read the FRESHEST cached
 * list at mutation time via `getQueryData` and take `max(order_index)+1`, so a
 * second create that fires after the first has settled (and its refetch landed)
 * sees the new item. The create callbacks also self-gate on the pending flag so
 * a double-click cannot fire two creates inside one render cycle.
 * ------------------------------------------------------------------------- */

/** Next append index from a list, or 0 when empty: `max(order_index)+1`. */
function appendIndex(items: { order_index: number }[] | undefined): number {
  if (!items || items.length === 0) return 0;
  return Math.max(...items.map((i) => i.order_index)) + 1;
}

/**
 * Next `order_index` for a chapter appended to a book — derived from the
 * FRESHEST cached chapter list (not a captured render value), so back-to-back
 * creates after a settled refetch get distinct indices. Falls back to 0 when the
 * list is not yet cached.
 */
export function nextChapterOrderIndex(
  queryClient: QueryClient,
  bookId: string,
): number {
  return appendIndex(
    queryClient.getQueryData<ChapterRead[]>(queryKeys.bookChapters(bookId)),
  );
}

/**
 * Next `order_index` for a scene appended to a chapter — derived from the
 * FRESHEST cached scene list. Falls back to 0 when the list is not yet cached.
 */
export function nextSceneOrderIndex(
  queryClient: QueryClient,
  chapterId: string,
): number {
  return appendIndex(
    queryClient.getQueryData<SceneRead[]>(queryKeys.chapterScenes(chapterId)),
  );
}

/* ---------------------------------------------------------------------------
 * Chapter CRUD + reorder (M7 Plan Board / ChapterTree create)
 *
 * Create/update/delete invalidate the book's chapter list (so the tree/board
 * pick up the change). Reorder is OPTIMISTIC: the cached chapter list is
 * reordered immediately, then the server is asked to persist; on error the
 * snapshot is rolled back. `onSettled` invalidates so the cache EVENTUALLY
 * re-syncs with the canonical server order — the FINAL state converges. On a
 * rapid sequence of same-key drags an earlier mutation's `onSettled` refetch can
 * momentarily clobber a later optimistic state before it settles (a brief stale
 * flicker), but each persist still lands and the last settle wins, so the
 * converged order is correct. We do NOT serialize same-key reorders: dropping or
 * deferring a later drag would risk losing it, a worse outcome than the flicker.
 * ------------------------------------------------------------------------- */

/** Input for the chapter-create mutation (book id + body). */
export interface CreateChapterInput {
  bookId: string;
  data: ChapterCreate;
}

/**
 * Create a chapter under a book; invalidates the book's chapter list on success
 * so the Plan Board / ChapterTree pick up the new chapter. Returns the created
 * chapter (its id drives any follow-up scene create / navigation). Errors
 * propagate via the mutation's `error`.
 */
export function useCreateChapter(): UseMutationResult<
  ChapterRead,
  Error,
  CreateChapterInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, data }: CreateChapterInput) =>
      createChapter(bookId, data),
    onSuccess: (created) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookChapters(created.book_id),
      }),
  });
}

/** Input for the chapter-update mutation (book + chapter id + patch). */
export interface UpdateChapterInput {
  bookId: string;
  chapterId: string;
  patch: ChapterUpdate;
}

/** Patch a chapter; invalidates the book's chapter list on success. */
export function useUpdateChapter(): UseMutationResult<
  ChapterRead,
  Error,
  UpdateChapterInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, chapterId, patch }: UpdateChapterInput) =>
      updateChapter(bookId, chapterId, patch),
    onSuccess: (updated) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookChapters(updated.book_id),
      }),
  });
}

/** Input for the chapter-delete mutation (book + chapter id). */
export interface DeleteChapterInput {
  bookId: string;
  chapterId: string;
}

/** Delete a chapter; invalidates the book's chapter list on success. */
export function useDeleteChapter(): UseMutationResult<
  void,
  Error,
  DeleteChapterInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, chapterId }: DeleteChapterInput) =>
      deleteChapter(bookId, chapterId),
    onSuccess: (_data, { bookId }) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookChapters(bookId),
      }),
  });
}

/** Input for the chapter-reorder mutation (book id + the new id sequence). */
export interface ReorderChaptersInput {
  bookId: string;
  /** Full list of chapter ids in their new order. */
  order: string[];
}

/** Snapshot kept across the optimistic chapter-reorder for rollback. */
interface ReorderChaptersContext {
  previous: ChapterRead[] | undefined;
}

/**
 * Reorder a book's chapters with an optimistic cache update + rollback. The
 * cached chapter list is reordered to `order` immediately (so the board does not
 * flicker for a single drag), then the server persists the order. On error the
 * previous snapshot is restored; `onSettled` always invalidates so the cache
 * EVENTUALLY re-syncs with the canonical server order. Guarantee: the FINAL
 * state converges — every persist lands and the last settle wins. NOT
 * guaranteed: freedom from an intermediate flicker on rapid same-key drags,
 * where an earlier mutation's settle-refetch can briefly clobber a later
 * optimistic order before it settles. The `bookId` guard in the caller
 * (`usePlanBoard.reorderChapters`) skips the call when the route has no book.
 * Errors propagate via the mutation's `error`.
 */
export function useReorderChapters(): UseMutationResult<
  ChapterRead[],
  Error,
  ReorderChaptersInput,
  ReorderChaptersContext
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, order }: ReorderChaptersInput) =>
      reorderChapters(bookId, order),
    onMutate: async ({ bookId, order }) => {
      const key = queryKeys.bookChapters(bookId);
      // Cancel in-flight list refetches so they cannot clobber our optimistic
      // write between onMutate and the mutation resolving.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ChapterRead[]>(key);
      if (previous) {
        queryClient.setQueryData<ChapterRead[]>(
          key,
          reorderByIds(previous, order),
        );
      }
      return { previous };
    },
    onError: (_err, { bookId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.bookChapters(bookId),
          context.previous,
        );
      }
    },
    onSettled: (_data, _err, { bookId }) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookChapters(bookId),
      }),
  });
}

/* ---------------------------------------------------------------------------
 * Scene CRUD + reorder (M7 Plan Board / ChapterTree create)
 * ------------------------------------------------------------------------- */

/** Input for the scene-create mutation (chapter id + body). */
export interface CreateSceneInput {
  chapterId: string;
  data: SceneCreate;
}

/**
 * Create a scene under a chapter; invalidates the chapter's scene list on
 * success so the board/tree pick up the new scene. Returns the created scene
 * (its id drives the create→open navigation that closes the create→write loop).
 * Errors propagate via the mutation's `error`.
 */
export function useCreateScene(): UseMutationResult<
  SceneRead,
  Error,
  CreateSceneInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chapterId, data }: CreateSceneInput) =>
      createScene(chapterId, data),
    onSuccess: (created) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.chapterScenes(created.chapter_id),
      }),
  });
}

/** Input for the scene-delete mutation (chapter + scene id). */
export interface DeleteSceneInput {
  chapterId: string;
  sceneId: string;
}

/** Delete a scene; invalidates the chapter's scene list on success. */
export function useDeleteScene(): UseMutationResult<
  void,
  Error,
  DeleteSceneInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chapterId, sceneId }: DeleteSceneInput) =>
      deleteScene(chapterId, sceneId),
    onSuccess: (_data, { chapterId }) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.chapterScenes(chapterId),
      }),
  });
}

/** Input for the scene-archive mutation (chapter + scene id). */
export interface ArchiveSceneInput {
  chapterId: string;
  sceneId: string;
}

/**
 * Archive a scene (soft-delete). The list endpoint excludes archived scenes, so
 * invalidating the chapter's scene list drops it from the board/tree. Errors
 * propagate via the mutation's `error`.
 */
export function useArchiveScene(): UseMutationResult<
  SceneRead,
  Error,
  ArchiveSceneInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chapterId, sceneId }: ArchiveSceneInput) =>
      archiveScene(chapterId, sceneId),
    onSuccess: (updated) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.chapterScenes(updated.chapter_id),
      }),
  });
}

/** Input for the scene-reorder mutation (chapter id + the new id sequence). */
export interface ReorderScenesInput {
  chapterId: string;
  /** Full list of scene ids within the chapter in their new order. */
  order: string[];
}

/** Snapshot kept across the optimistic scene-reorder for rollback. */
interface ReorderScenesContext {
  previous: SceneRead[] | undefined;
}

/**
 * Reorder the scenes of a chapter with an optimistic cache update + rollback.
 * Mirrors {@link useReorderChapters}: the cached scene list is reordered
 * immediately, the server persists, and on error the snapshot is restored.
 * `onSettled` invalidates so the cache EVENTUALLY re-syncs with the server
 * order — the FINAL state converges, but an intermediate flicker is possible on
 * rapid same-key drags (see {@link useReorderChapters} for the full reasoning).
 * Reordering is WITHIN a single chapter only — the backend has no cross-chapter
 * scene move, and `chapterId` is part of the cache key, so (unlike the chapter
 * reorder) no extra book-scope guard is needed here.
 */
export function useReorderScenes(): UseMutationResult<
  SceneRead[],
  Error,
  ReorderScenesInput,
  ReorderScenesContext
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chapterId, order }: ReorderScenesInput) =>
      reorderScenes(chapterId, order),
    onMutate: async ({ chapterId, order }) => {
      const key = queryKeys.chapterScenes(chapterId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SceneRead[]>(key);
      if (previous) {
        queryClient.setQueryData<SceneRead[]>(
          key,
          reorderByIds(previous, order),
        );
      }
      return { previous };
    },
    onError: (_err, { chapterId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.chapterScenes(chapterId),
          context.previous,
        );
      }
    },
    onSettled: (_data, _err, { chapterId }) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.chapterScenes(chapterId),
      }),
  });
}

/** Input for the scene-move mutation (cross-chapter — P1.5). */
export interface MoveSceneInput {
  sceneId: string;
  fromChapterId: string;
  toChapterId: string;
  /** 0-based insertion slot within the target chapter. */
  targetIndex: number;
}

/** Snapshot of BOTH chapters' scene lists kept across the optimistic move. */
interface MoveSceneContext {
  previousFrom: SceneRead[] | undefined;
  previousTo: SceneRead[] | undefined;
}

/** Dense-renumber a scene list: `order_index = position` (0..n-1). */
function renumber(scenes: SceneRead[]): SceneRead[] {
  return scenes.map((scene, index) => ({ ...scene, order_index: index }));
}

/**
 * Move a scene to another chapter with an optimistic cache update + rollback
 * across BOTH chapters' scene lists (P1.5). On `onMutate` the scene is removed
 * from the source chapter's cached list (closing the gap, densely renumbered)
 * and spliced into the target chapter's cached list at `targetIndex` (also
 * densely renumbered) with its `chapter_id` rewritten — mirroring the server's
 * two-sided renumber. Both pre-move snapshots are kept so a server error rolls
 * BOTH lists back. `onSettled` invalidates BOTH chapters' lists so the cache
 * re-syncs with the canonical server order (the final state converges).
 *
 * The moved scene is never lost or duplicated: it is dropped from the source by
 * id BEFORE being inserted into the target, and the source/target keys differ.
 * Errors propagate via the mutation's `error` (never swallowed).
 */
export function useMoveScene(): UseMutationResult<
  SceneRead,
  Error,
  MoveSceneInput,
  MoveSceneContext
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sceneId, toChapterId, targetIndex }: MoveSceneInput) =>
      moveScene(sceneId, toChapterId, targetIndex),
    onMutate: async ({ sceneId, fromChapterId, toChapterId, targetIndex }) => {
      const fromKey = queryKeys.chapterScenes(fromChapterId);
      const toKey = queryKeys.chapterScenes(toChapterId);
      // Cancel in-flight refetches on BOTH lists so they cannot clobber the
      // optimistic write between onMutate and the mutation resolving.
      await queryClient.cancelQueries({ queryKey: fromKey });
      await queryClient.cancelQueries({ queryKey: toKey });

      const previousFrom = queryClient.getQueryData<SceneRead[]>(fromKey);
      const previousTo = queryClient.getQueryData<SceneRead[]>(toKey);

      // The moving scene comes from the source snapshot; bail the optimistic
      // step if it is not cached (the onSettled invalidation still re-syncs).
      const moving = previousFrom?.find((s) => s.id === sceneId);
      if (previousFrom && moving) {
        queryClient.setQueryData<SceneRead[]>(
          fromKey,
          renumber(previousFrom.filter((s) => s.id !== sceneId)),
        );
        // Insert into the target at the clamped slot; rewrite chapter_id so the
        // board attributes the card to its new column. Defensively drop any
        // stale copy of the scene from the target list first (no duplicates).
        const targetBase = (previousTo ?? []).filter((s) => s.id !== sceneId);
        const index = Math.max(0, Math.min(targetIndex, targetBase.length));
        const next = targetBase.slice();
        next.splice(index, 0, { ...moving, chapter_id: toChapterId });
        queryClient.setQueryData<SceneRead[]>(toKey, renumber(next));
      }

      return { previousFrom, previousTo };
    },
    onError: (_err, { fromChapterId, toChapterId }, context) => {
      // Restore BOTH snapshots (only if they were captured).
      if (context?.previousFrom !== undefined) {
        queryClient.setQueryData(
          queryKeys.chapterScenes(fromChapterId),
          context.previousFrom,
        );
      }
      if (context?.previousTo !== undefined) {
        queryClient.setQueryData(
          queryKeys.chapterScenes(toChapterId),
          context.previousTo,
        );
      }
    },
    onSettled: (_data, _err, { fromChapterId, toChapterId }) => {
      // Re-sync BOTH chapters with the canonical server order.
      return Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.chapterScenes(fromChapterId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.chapterScenes(toChapterId),
        }),
      ]);
    },
  });
}

/**
 * Reorder a list of entities to match an `order` array of ids. Items present in
 * `order` come first in that exact sequence; any item not referenced in `order`
 * keeps its relative position at the end (defensive — the board always passes
 * the full id set, but this guarantees no item is silently dropped).
 */
function reorderByIds<T extends { id: string }>(
  items: T[],
  order: string[],
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered: T[] = [];
  for (const id of order) {
    const item = byId.get(id);
    if (item) {
      ordered.push(item);
      byId.delete(id);
    }
  }
  // Append any leftovers (not referenced in `order`) in their original order.
  for (const item of items) {
    if (byId.has(item.id)) ordered.push(item);
  }
  return ordered;
}

/* ---------------------------------------------------------------------------
 * Beats (scene-scoped — M5 inspector Beatek tab)
 * ------------------------------------------------------------------------- */

/** List a scene's beats. Disabled until a scene id is supplied. */
export function useSceneBeats(
  sceneId: string | undefined,
): UseQueryResult<BeatRead[], Error> {
  return useQuery({
    queryKey: queryKeys.sceneBeats(sceneId ?? "__none__"),
    queryFn: () => listBeats(sceneId as string),
    enabled: Boolean(sceneId),
  });
}

/** Input for the beat-create mutation (scene id + body). */
export interface CreateBeatInput {
  sceneId: string;
  data: BeatCreate;
}

/** Create a beat under a scene; invalidates the scene's beat list on success. */
export function useCreateBeat(): UseMutationResult<
  BeatRead,
  Error,
  CreateBeatInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sceneId, data }: CreateBeatInput) =>
      createBeat(sceneId, data),
    onSuccess: (created) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.sceneBeats(created.scene_id),
      }),
  });
}

/* ---------------------------------------------------------------------------
 * Codex (read-only — M4 CodexMention popover; full CRUD is M6)
 * ------------------------------------------------------------------------- */

/** List a project's codex entries. Disabled until a project id is supplied. */
export function useCodexEntries(
  projectId: string | undefined,
): UseQueryResult<CodexEntryRead[], Error> {
  return useQuery({
    queryKey: queryKeys.projectCodex(projectId ?? "__none__"),
    queryFn: () => listCodexEntries(projectId as string),
    enabled: Boolean(projectId),
  });
}

/**
 * Fetch one codex entry. Disabled until both ids are present. The detail screen
 * uses this to refetch the canonical entry (e.g. after a deep-link), but it also
 * works off the cached list entry when present.
 */
export function useCodexEntry(
  projectId: string | undefined,
  entryId: string | undefined,
): UseQueryResult<CodexEntryRead, Error> {
  return useQuery({
    queryKey: queryKeys.codexEntry(
      projectId ?? "__none__",
      entryId ?? "__none__",
    ),
    queryFn: () => getCodexEntry(projectId as string, entryId as string),
    enabled: Boolean(projectId) && Boolean(entryId),
  });
}

/** Input for the codex-create mutation (project id + body). */
export interface CreateCodexEntryInput {
  projectId: string;
  data: CodexEntryCreate;
}

/**
 * Create a codex entry under a project; invalidates the project's codex list on
 * success so the sidebar picks up the new entry. Returns the created entry (its
 * id drives the post-create selection). Errors propagate via the mutation.
 */
export function useCreateCodexEntry(): UseMutationResult<
  CodexEntryRead,
  Error,
  CreateCodexEntryInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: CreateCodexEntryInput) =>
      createCodexEntry(projectId, data),
    onSuccess: (created) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectCodex(created.project_id),
      }),
  });
}

/** Input for the codex-update mutation (project + entry id + patch). */
export interface UpdateCodexEntryInput {
  projectId: string;
  entryId: string;
  patch: CodexEntryUpdate;
}

/**
 * Patch a codex entry (name / description / role / aliases / ai_visible). On
 * success the single-entry cache + the list entry are updated in place so the
 * detail and the sidebar reflect the change without a refetch flicker. Errors
 * propagate via the mutation's `error` (never swallowed).
 */
export function useUpdateCodexEntry(): UseMutationResult<
  CodexEntryRead,
  Error,
  UpdateCodexEntryInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, entryId, patch }: UpdateCodexEntryInput) =>
      updateCodexEntry(projectId, entryId, patch),
    onSuccess: (updated) => {
      queryClient.setQueryData(
        queryKeys.codexEntry(updated.project_id, updated.id),
        updated,
      );
      queryClient.setQueryData<CodexEntryRead[]>(
        queryKeys.projectCodex(updated.project_id),
        (prev) =>
          prev ? prev.map((e) => (e.id === updated.id ? updated : e)) : prev,
      );
    },
  });
}

/** Input for the codex-delete mutation (project + entry id). */
export interface DeleteCodexEntryInput {
  projectId: string;
  entryId: string;
}

/**
 * Delete a codex entry; invalidates the project's codex list on success. Errors
 * propagate via the mutation's `error`.
 */
export function useDeleteCodexEntry(): UseMutationResult<
  void,
  Error,
  DeleteCodexEntryInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, entryId }: DeleteCodexEntryInput) =>
      deleteCodexEntry(projectId, entryId),
    onSuccess: (_data, { projectId }) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.projectCodex(projectId),
      }),
  });
}
