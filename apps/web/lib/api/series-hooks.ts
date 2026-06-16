"use client";

/**
 * TanStack Query hooks for the Series resource (Feature #3a).
 *
 * Series are project-scoped (`/projects/{pid}/series`). The list drives the
 * Codex scope-toggle (series scope) and the series management + codex-entry
 * scope-picker controls. Mutations invalidate the project's series list on
 * success so those controls stay fresh; errors propagate via Query's
 * `error` / `isError` (never swallowed).
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  createSeries,
  deleteSeries,
  listSeries,
  updateSeries,
} from "./series";
import type { SeriesCreate, SeriesRead, SeriesUpdate } from "./types";

/** Stable query-key factory for the Series resource. */
export const seriesQueryKeys = {
  projectSeries: (projectId: string) =>
    ["projects", projectId, "series"] as const,
};

/** List a project's series. Disabled until a project id is supplied. */
export function useSeries(
  projectId: string | undefined,
): UseQueryResult<SeriesRead[], Error> {
  return useQuery({
    queryKey: seriesQueryKeys.projectSeries(projectId ?? "__none__"),
    queryFn: () => listSeries(projectId as string),
    enabled: Boolean(projectId),
  });
}

/** Input for the series-create mutation (project id + body). */
export interface CreateSeriesInput {
  projectId: string;
  data: SeriesCreate;
}

/**
 * Create a series under a project; invalidates the project's series list on
 * success. Returns the created series. Errors propagate via the mutation.
 */
export function useCreateSeries(): UseMutationResult<
  SeriesRead,
  Error,
  CreateSeriesInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: CreateSeriesInput) =>
      createSeries(projectId, data),
    onSuccess: (created) =>
      queryClient.invalidateQueries({
        queryKey: seriesQueryKeys.projectSeries(created.project_id),
      }),
  });
}

/** Input for the series-update mutation (project + series id + patch). */
export interface UpdateSeriesInput {
  projectId: string;
  seriesId: string;
  patch: SeriesUpdate;
}

/** Patch a series (rename / reorder); invalidates the project's series list. */
export function useUpdateSeries(): UseMutationResult<
  SeriesRead,
  Error,
  UpdateSeriesInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, seriesId, patch }: UpdateSeriesInput) =>
      updateSeries(projectId, seriesId, patch),
    onSuccess: (updated) =>
      queryClient.invalidateQueries({
        queryKey: seriesQueryKeys.projectSeries(updated.project_id),
      }),
  });
}

/** Input for the series-delete mutation (project + series id). */
export interface DeleteSeriesInput {
  projectId: string;
  seriesId: string;
}

/**
 * Delete a series; invalidates the project's series list AND the project's codex
 * lists on success (an entry that was series-scoped becomes project-global / its
 * series view disappears). Errors propagate via the mutation's `error`.
 */
export function useDeleteSeries(): UseMutationResult<
  void,
  Error,
  DeleteSeriesInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, seriesId }: DeleteSeriesInput) =>
      deleteSeries(projectId, seriesId),
    onSuccess: async (_data, { projectId }) => {
      await queryClient.invalidateQueries({
        queryKey: seriesQueryKeys.projectSeries(projectId),
      });
      // Prefix-invalidate every codex list for the project (project + series
      // scopes) so a removed series no longer appears in any cached view.
      await queryClient.invalidateQueries({
        queryKey: ["projects", projectId, "codex"],
      });
    },
  });
}
