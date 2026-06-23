"use client";

/**
 * Plan Board controller hook. This is where ALL the board's business/data logic
 * lives (per the M7 rules — components only render state + fire callbacks):
 *
 * - derives the `PlanChapter[]` view-model from `useBookTree(bookId)` (status +
 *   POV resolved; POV character names resolved against the project Codex),
 * - applies the search filter,
 * - exposes create / reorder / delete / archive / duplicate actions wired to the
 *   M7 mutation hooks, each with a toast on success and an error toast on
 *   failure (no swallowed errors),
 * - exposes navigation helpers (open a scene in the editor — the create→write
 *   loop), and the empty-book "create first chapter (+ first scene)" flow.
 *
 * Reorder is optimistic at the cache layer (see `useReorderChapters` /
 * `useReorderScenes`); this hook just computes the new id order and fires the
 * mutation, then toasts.
 */
import { useCallback, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/kit/toast";
import { routes } from "@/lib/routes";
import { useNavTo } from "@/lib/use-nav-to";
import { povSlot } from "@/lib/pov-color";
import { hu } from "@/lib/i18n/hu";
import {
  nextChapterOrderIndex,
  nextSceneOrderIndex,
  useArchiveScene,
  useBookTree,
  useCreateChapter,
  useCreateScene,
  useDeleteScene,
  useMoveScene,
  useReorderChapters,
  useReorderScenes,
  type BookTreeResult,
  type ChapterWithScenes,
} from "@/lib/api/hooks";
import { useBookProjectId } from "@/lib/api/ai-hooks";
import { useCodexEntries } from "@/lib/api/hooks";
import type { CodexEntryRead, SceneRead } from "@/lib/api/types";
import type { PlanChapter, PlanScene, PovBadge } from "./types";

/** Build the POV badge list for a scene from its `pov_character_id`. */
function resolvePov(
  scene: SceneRead,
  charById: Map<string, CodexEntryRead>,
): PovBadge[] {
  if (!scene.pov_character_id) return [];
  const character = charById.get(scene.pov_character_id);
  // Resolve to the character name when known; otherwise fall back to the id so
  // the badge is never blank (and the colour stays stable via the same hash).
  const label = character?.title ?? scene.pov_character_id;
  return [{ label, slot: povSlot(label) }];
}

/** Map a chapter+scenes record into the board's PlanChapter view-model. */
function toPlanChapter(
  chapter: ChapterWithScenes,
  index: number,
  charById: Map<string, CodexEntryRead>,
): PlanChapter {
  return {
    id: chapter.id,
    bookId: chapter.book_id,
    index: index + 1,
    title: chapter.title,
    raw: chapter,
    scenes: chapter.scenes.map(
      (scene, sceneIndex): PlanScene => ({
        id: scene.id,
        chapterId: chapter.id,
        index: sceneIndex + 1,
        title: scene.title || hu.plan.sceneNumber(sceneIndex + 1),
        summary: scene.summary,
        status: scene.status,
        pov: resolvePov(scene, charById),
        raw: scene,
      }),
    ),
  };
}

export interface PlanBoardController {
  /** The book id this board belongs to. */
  bookId: string | undefined;
  /** The filtered, view-model chapters. */
  chapters: PlanChapter[];
  /** True when there are chapters before filtering (distinguishes empty-book vs no-search-match). */
  hasAnyChapter: boolean;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  /** Refetch the full book tree (chapters + all per-chapter scene queries). */
  refetch: () => void;
  /** True while a create mutation is in flight (disables the relevant CTA). */
  isCreating: boolean;
  /** Open a scene in the editor — the create→write loop's exit. */
  openScene: (sceneId: string) => void;
  /** Create a chapter at the end of the book. */
  createChapter: () => void;
  /** Empty-book flow: create the first chapter, a first scene in it, then open it. */
  createFirstChapter: () => void;
  /** Create a scene at the end of a chapter, then open it. */
  createScene: (chapterId: string) => void;
  /** Persist a new chapter order (full id list). */
  reorderChapters: (order: string[]) => void;
  /** Persist a new scene order within a chapter (full id list). */
  reorderScenes: (chapterId: string, order: string[]) => void;
  /** Move a scene to another chapter at a target position (cross-chapter). */
  moveScene: (
    sceneId: string,
    fromChapterId: string,
    toChapterId: string,
    targetIndex: number,
  ) => void;
  /** Delete a scene. */
  deleteScene: (chapterId: string, sceneId: string) => void;
  /** Archive a scene (soft-delete). */
  archiveScene: (chapterId: string, sceneId: string) => void;
  /** Duplicate a scene (copies title/content/summary/status/pov to a new scene). */
  duplicateScene: (scene: SceneRead) => void;
  /** POV change — backend has no simple picker, so this is a documented stub. */
  changePov: () => void;
}

export interface UsePlanBoardOptions {
  bookId: string | undefined;
  /** Current search query (filters scenes by title/summary). */
  search: string;
}

/**
 * The Plan Board controller. Wires the tree, the Codex (for POV names) and every
 * mutation. Returns a stable-enough API for the board components.
 */
export function usePlanBoard({
  bookId,
  search,
}: UsePlanBoardOptions): PlanBoardController {
  const queryClient = useQueryClient();
  const tree: BookTreeResult = useBookTree(bookId);
  const projectIdQuery = useBookProjectId(bookId);
  const codexQuery = useCodexEntries(projectIdQuery.data);

  const navTo = useNavTo();

  const createChapterMutation = useCreateChapter();
  const createSceneMutation = useCreateScene();
  const reorderChaptersMutation = useReorderChapters();
  const reorderScenesMutation = useReorderScenes();
  const moveSceneMutation = useMoveScene();
  const deleteSceneMutation = useDeleteScene();
  const archiveSceneMutation = useArchiveScene();

  // A single in-flight guard shared by every create entry point. `isCreating`
  // drives the disabled state of the CTAs (it tracks the mutations' pending
  // flags). The SYNCHRONOUS double-fire (two create calls in one render cycle,
  // before React re-renders with the new pending flag) is blocked by a ref set
  // the instant a create fires and cleared in the mutation's onSettled — a
  // closure-captured `isPending` would still read false on the second call.
  const creatingRef = useRef(false);
  const isCreating =
    createChapterMutation.isPending || createSceneMutation.isPending;

  /**
   * Claim the create-in-flight guard. Returns false (and does nothing) when a
   * create is already in flight, so the caller can bail out. The claim is
   * released by {@link releaseCreateGuard} in the mutation's onSettled.
   */
  const claimCreateGuard = useCallback((): boolean => {
    if (creatingRef.current) return false;
    creatingRef.current = true;
    return true;
  }, []);

  /** Release the create-in-flight guard (wired into every create's onSettled). */
  const releaseCreateGuard = useCallback(() => {
    creatingRef.current = false;
  }, []);

  /** Character entries keyed by id (POV ids reference Codex character entries). */
  const charById = useMemo(() => {
    const map = new Map<string, CodexEntryRead>();
    for (const entry of codexQuery.data ?? []) map.set(entry.id, entry);
    return map;
  }, [codexQuery.data]);

  const allChapters = useMemo(
    () =>
      tree.chapters.map((chapter, index) =>
        toPlanChapter(chapter, index, charById),
      ),
    [tree.chapters, charById],
  );

  /** Apply the search filter: keep scenes whose title/summary matches; drop
   * empty chapters only when a query is active (so the columns stay visible
   * otherwise). The chapter view-model keeps its ORIGINAL scene indices via the
   * pre-filter mapping above, so "N. jelenet" never renumbers on filter. */
  const chapters = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return allChapters;
    return allChapters
      .map((chapter) => ({
        ...chapter,
        scenes: chapter.scenes.filter((scene) => {
          const haystack = `${scene.title} ${scene.summary ?? ""}`.toLowerCase();
          return haystack.includes(query);
        }),
      }))
      .filter((chapter) => chapter.scenes.length > 0);
  }, [allChapters, search]);

  const openScene = useCallback(
    (sceneId: string) => {
      if (bookId) navTo(routes.scene(bookId, sceneId));
    },
    [bookId, navTo],
  );

  const createChapter = useCallback(() => {
    // Self-gate (order_index collision fix): claim the in-flight guard
    // synchronously so a double-fire within one render cycle cannot race to the
    // same append index. The CTAs are also disabled via `isCreating`.
    if (!bookId || !claimCreateGuard()) return;
    // Append index from the FRESHEST cache (not a captured `.length`), so a
    // create fired after a prior one settles sees the new chapter.
    const order = nextChapterOrderIndex(queryClient, bookId);
    createChapterMutation.mutate(
      {
        bookId,
        data: {
          title: hu.plan.newChapterDefaultTitle(order + 1),
          order_index: order,
          status: "draft",
        },
      },
      {
        onSuccess: () => toast.success(hu.plan.toastChapterCreated),
        onError: () => toast.error(hu.plan.errorChapterCreate),
        onSettled: releaseCreateGuard,
      },
    );
  }, [bookId, claimCreateGuard, releaseCreateGuard, queryClient, createChapterMutation]);

  const createScene = useCallback(
    (chapterId: string) => {
      if (!claimCreateGuard()) return; // self-gate (see createChapter)
      const order = nextSceneOrderIndex(queryClient, chapterId);
      createSceneMutation.mutate(
        {
          chapterId,
          data: {
            title: hu.plan.newSceneDefaultTitle(order + 1),
            order_index: order,
            status: "draft",
          },
        },
        {
          onSuccess: (created) => {
            toast.success(hu.plan.toastSceneCreated);
            // Close the create→write loop: open the new scene in the editor.
            openScene(created.id);
          },
          onError: () => toast.error(hu.plan.errorSceneCreate),
          onSettled: releaseCreateGuard,
        },
      );
    },
    [claimCreateGuard, releaseCreateGuard, queryClient, createSceneMutation, openScene],
  );

  /**
   * Empty-book flow: create the first chapter, then a first scene inside it, then
   * open that scene — turning a freshly-created book into a writable one in one
   * click (the M7 dead-end fix). The scene-create is chained inside the
   * chapter-create success so it targets the real new chapter id.
   */
  const createFirstChapter = useCallback(() => {
    if (!bookId || !claimCreateGuard()) return; // self-gate (see createChapter)
    createChapterMutation.mutate(
      {
        bookId,
        data: {
          title: hu.plan.newChapterDefaultTitle(1),
          order_index: 0,
          status: "draft",
        },
      },
      {
        onSuccess: (createdChapter) => {
          toast.success(hu.plan.toastChapterCreated);
          createSceneMutation.mutate(
            {
              chapterId: createdChapter.id,
              data: {
                title: hu.plan.newSceneDefaultTitle(1),
                order_index: 0,
                status: "draft",
              },
            },
            {
              onSuccess: (createdScene) => openScene(createdScene.id),
              onError: () => toast.error(hu.plan.errorSceneCreate),
              // Hold the guard across the CHAINED scene create; release only
              // once the whole empty-book flow settles.
              onSettled: releaseCreateGuard,
            },
          );
        },
        // If the chapter create fails there is no chained scene, so release here.
        onError: () => {
          toast.error(hu.plan.errorChapterCreate);
          releaseCreateGuard();
        },
      },
    );
  }, [
    bookId,
    claimCreateGuard,
    releaseCreateGuard,
    createChapterMutation,
    createSceneMutation,
    openScene,
  ]);

  const reorderChapters = useCallback(
    (order: string[]) => {
      if (!bookId) return;
      reorderChaptersMutation.mutate(
        { bookId, order },
        {
          onSuccess: () => toast.success(hu.plan.toastChapterMoved),
          onError: () => toast.error(hu.plan.errorReorder),
        },
      );
    },
    [bookId, reorderChaptersMutation],
  );

  const reorderScenes = useCallback(
    (chapterId: string, order: string[]) => {
      reorderScenesMutation.mutate(
        { chapterId, order },
        {
          onSuccess: () => toast.success(hu.plan.toastSceneMoved),
          onError: () => toast.error(hu.plan.errorReorder),
        },
      );
    },
    [reorderScenesMutation],
  );

  const moveScene = useCallback(
    (
      sceneId: string,
      fromChapterId: string,
      toChapterId: string,
      targetIndex: number,
    ) => {
      moveSceneMutation.mutate(
        { sceneId, fromChapterId, toChapterId, targetIndex },
        {
          onSuccess: () => toast.success(hu.plan.toastSceneMoved),
          onError: () => toast.error(hu.plan.errorReorder),
        },
      );
    },
    [moveSceneMutation],
  );

  const deleteScene = useCallback(
    (chapterId: string, sceneId: string) => {
      deleteSceneMutation.mutate(
        { chapterId, sceneId },
        {
          onSuccess: () => toast.success(hu.plan.toastSceneDeleted),
          onError: () => toast.error(hu.plan.errorSceneDelete),
        },
      );
    },
    [deleteSceneMutation],
  );

  const archiveScene = useCallback(
    (chapterId: string, sceneId: string) => {
      archiveSceneMutation.mutate(
        { chapterId, sceneId },
        {
          onSuccess: () => toast.success(hu.plan.toastSceneArchived),
          onError: () => toast.error(hu.plan.errorSceneArchive),
        },
      );
    },
    [archiveSceneMutation],
  );

  const duplicateScene = useCallback(
    (scene: SceneRead) => {
      if (!claimCreateGuard()) return; // self-gate (see createChapter)
      const order = nextSceneOrderIndex(queryClient, scene.chapter_id);
      createSceneMutation.mutate(
        {
          chapterId: scene.chapter_id,
          data: {
            title: scene.title,
            content: scene.content,
            summary: scene.summary,
            status: scene.status,
            pov_character_id: scene.pov_character_id,
            order_index: order,
          },
        },
        {
          onSuccess: () => toast.success(hu.plan.toastSceneDuplicated),
          onError: () => toast.error(hu.plan.errorSceneCreate),
          onSettled: releaseCreateGuard,
        },
      );
    },
    [claimCreateGuard, releaseCreateGuard, queryClient, createSceneMutation],
  );

  // POV change needs a character picker that the backend/spec does not define
  // for the board; surfaced as a documented stub toast (verbatim prototype copy)
  // rather than a silent no-op. Wiring lands with the V1 POV picker.
  const changePov = useCallback(() => {
    toast.info(hu.plan.toastPov);
  }, []);

  return {
    bookId,
    chapters,
    hasAnyChapter: allChapters.length > 0,
    isLoading: tree.isLoading,
    isError: tree.isError,
    error: tree.error,
    refetch: tree.refetch,
    isCreating,
    openScene,
    createChapter,
    createFirstChapter,
    createScene,
    reorderChapters,
    reorderScenes,
    moveScene,
    deleteScene,
    archiveScene,
    duplicateScene,
    changePov,
  };
}
