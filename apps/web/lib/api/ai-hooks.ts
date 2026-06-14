"use client";

/**
 * TanStack Query hooks for the M5 AI flow: model listing, the AI generation
 * mutations (rewrite / describe / generate-scene / write-continue), the
 * revision-approval mutation (the human-in-the-loop accept step) and the
 * snippet-create mutation (the Star action).
 *
 * Errors propagate via Query's `error` / `isError` (never swallowed). Business
 * logic lives here + in `lib/api/ai.ts`; components only render state and fire
 * callbacks.
 */
import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  approveRevision,
  createSnippet,
  describe,
  generateScene,
  listModels,
  resolveProjectIdForBook,
  rewrite,
  writeContinue,
} from "./ai";
import type {
  AIDescribeResult,
  AIResult,
  DescribeRequest,
  GenerateSceneRequest,
  ModelsResponse,
  RevisionRead,
  RewriteRequest,
  SnippetCreate,
  SnippetRead,
  WriteContinueRequest,
} from "./ai-types";

/** Query keys for the AI/snippet resources. */
export const aiQueryKeys = {
  models: ["ai", "models"] as const,
  bookProject: (bookId: string) => ["ai", "book-project", bookId] as const,
};

/**
 * List the configured AI models (config-driven; never hardcoded). The result
 * drives the ModelSelector + the active-model badge across the editor.
 */
export function useModels(): UseQueryResult<ModelsResponse, Error> {
  return useQuery({
    queryKey: aiQueryKeys.models,
    queryFn: () => listModels(),
    // Models change rarely; keep them fresh for the session.
    staleTime: 5 * 60_000,
  });
}

/** Resolve the owning project id for a book (cached). Disabled until a book id. */
export function useBookProjectId(
  bookId: string | undefined,
): UseQueryResult<string, Error> {
  return useQuery({
    queryKey: aiQueryKeys.bookProject(bookId ?? "__none__"),
    queryFn: () => resolveProjectIdForBook(bookId as string),
    enabled: Boolean(bookId),
    staleTime: Infinity,
  });
}

/* ---------------------------------------------------------------------------
 * AI generation mutations. Each resolves to a Revision (`approved: false`) — the
 * editor NEVER inserts off these; insertion only follows an explicit approve.
 * ------------------------------------------------------------------------- */

export function useRewrite(): UseMutationResult<AIResult, Error, RewriteRequest> {
  return useMutation({ mutationFn: (input: RewriteRequest) => rewrite(input) });
}

export function useDescribe(): UseMutationResult<
  AIDescribeResult,
  Error,
  DescribeRequest
> {
  return useMutation({
    mutationFn: (input: DescribeRequest) => describe(input),
  });
}

export function useGenerateScene(): UseMutationResult<
  AIResult,
  Error,
  GenerateSceneRequest
> {
  return useMutation({
    mutationFn: (input: GenerateSceneRequest) => generateScene(input),
  });
}

export function useWriteContinue(): UseMutationResult<
  AIResult,
  Error,
  WriteContinueRequest
> {
  return useMutation({
    mutationFn: (input: WriteContinueRequest) => writeContinue(input),
  });
}

/* ---------------------------------------------------------------------------
 * Human-in-the-loop accept + Star-to-Snippet
 * ------------------------------------------------------------------------- */

/**
 * Approve a revision (the Elfogad step). The caller inserts the accepted text
 * into the editor ONLY after this resolves — the revision is the persisted
 * record of the AI output, never an auto-overwrite of the manuscript.
 */
export function useApproveRevision(): UseMutationResult<
  RevisionRead,
  Error,
  string
> {
  return useMutation({
    mutationFn: (revisionId: string) => approveRevision(revisionId),
  });
}

/** Input for the snippet-create mutation (project id + body). */
export interface CreateSnippetInput {
  projectId: string;
  data: SnippetCreate;
}

/** Save an AI suggestion as a Snippet (the Star action). */
export function useCreateSnippet(): UseMutationResult<
  SnippetRead,
  Error,
  CreateSnippetInput
> {
  return useMutation({
    mutationFn: ({ projectId, data }: CreateSnippetInput) =>
      createSnippet(projectId, data),
  });
}
