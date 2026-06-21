"use client";

/**
 * TanStack Query hooks for the revision browser (the "Revíziók" inspector tab).
 *
 * `useSceneRevisions` reads a scene's revision history; `useRestoreRevision`
 * (approve) and `useRejectRevision` mutate it. Restore overwrites the scene
 * content server-side, so it invalidates BOTH the revision list (statuses
 * change) AND the book tree (so the editor + board reflect the restored text).
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { approveRevision } from "./ai";
import { queryKeys } from "./hooks";
import { listRevisions, rejectRevision } from "./revisions";
import type { RevisionRead } from "./ai-types";

export const revisionKeys = {
  scene: (sceneId: string) => ["revisions", "scene", sceneId] as const,
};

/** A scene's revision history (newest-first). Disabled until a scene id. */
export function useSceneRevisions(
  sceneId: string | undefined,
): UseQueryResult<RevisionRead[], Error> {
  return useQuery({
    queryKey: revisionKeys.scene(sceneId ?? "__none__"),
    queryFn: () => listRevisions(sceneId as string),
    enabled: Boolean(sceneId),
  });
}

/** Identifies which revision to act on + the context to refresh afterwards. */
export interface RevisionActionInput {
  revisionId: string;
  sceneId: string;
  /** Owning book — invalidated on restore so the editor shows the new content. */
  bookId: string | undefined;
}

/**
 * Restore (approve) a revision: the backend overwrites the scene content. On
 * success, refresh the revision list AND the book tree so the editor/board pick
 * up the restored text.
 */
export function useRestoreRevision(): UseMutationResult<
  RevisionRead,
  Error,
  RevisionActionInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ revisionId }: RevisionActionInput) =>
      approveRevision(revisionId),
    onSuccess: async (_data, { sceneId, bookId }) => {
      await queryClient.invalidateQueries({
        queryKey: revisionKeys.scene(sceneId),
      });
      if (bookId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.bookChapters(bookId),
        });
      }
    },
  });
}

/** Reject a revision (discard the suggestion; scene untouched). */
export function useRejectRevision(): UseMutationResult<
  RevisionRead,
  Error,
  RevisionActionInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ revisionId }: RevisionActionInput) =>
      rejectRevision(revisionId),
    onSuccess: async (_data, { sceneId }) => {
      await queryClient.invalidateQueries({
        queryKey: revisionKeys.scene(sceneId),
      });
    },
  });
}
