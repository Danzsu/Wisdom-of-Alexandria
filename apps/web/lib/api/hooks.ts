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
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { createProject, getProject, listProjects } from "./projects";
import { createBook, listBooks } from "./books";
import { listChapters } from "./chapters";
import { listScenes, updateScene } from "./scenes";
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
  ChapterRead,
  CodexEntryCreate,
  CodexEntryRead,
  CodexEntryUpdate,
  ProjectCreate,
  ProjectRead,
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
