"use client";

/**
 * TanStack Query hooks for the Projects/Books resources.
 *
 * Project↔Book mapping: a Book belongs to a Project (`/projects/{pid}/books`).
 * The New-book wizard therefore creates a Project first, then a Book under it —
 * see {@link useCreateBookWithProject}. Errors propagate to the UI via Query's
 * `error` / `isError` (never swallowed); mutations invalidate the relevant
 * caches on success.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { createProject, getProject, listProjects } from "./projects";
import { createBook, listBooks } from "./books";
import type {
  BookCreate,
  BookRead,
  ProjectCreate,
  ProjectRead,
} from "./types";

/** Stable query-key factory — keeps cache keys consistent across the app. */
export const queryKeys = {
  projects: ["projects"] as const,
  project: (id: string) => ["projects", id] as const,
  projectBooks: (projectId: string) =>
    ["projects", projectId, "books"] as const,
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
