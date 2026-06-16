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
  checkContinuity,
  createSnippet,
  describe,
  generateScene,
  listModels,
  resolveProjectIdForBook,
  rewrite,
  writeContinue,
} from "./ai";
import { listJobs } from "./jobs";
import type {
  AIDescribeResult,
  AIResult,
  ContinuityResult,
  DescribeRequest,
  GenerateSceneRequest,
  GenerationJobRead,
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
  jobs: (bookId: string) => ["jobs", bookId] as const,
};

/* ---------------------------------------------------------------------------
 * Generation jobs (B1 — live AI-feladatok screen + nav attention badge).
 *
 * Interactive single-scene AI is SYNCHRONOUS, so the job list is mostly a
 * history view; the poll keeps it (and the nav badge) live and surfaces any
 * failures without a manual refresh. Errors surface via Query's `error` /
 * `isError` — never swallowed.
 * ------------------------------------------------------------------------- */

/** How often the jobs list re-polls (ms) so the screen + badge stay live. */
const JOBS_POLL_INTERVAL_MS = 5_000;

/**
 * List the generation jobs for a book (newest first), polling every ~5s so the
 * screen and the nav badge stay live. Disabled until a book id is supplied.
 */
export function useJobs(
  bookId: string | undefined,
): UseQueryResult<GenerationJobRead[], Error> {
  return useQuery({
    queryKey: aiQueryKeys.jobs(bookId ?? "__none__"),
    queryFn: () => listJobs({ bookId: bookId as string }),
    enabled: Boolean(bookId),
    refetchInterval: JOBS_POLL_INTERVAL_MS,
    // Don't poll a hidden tab, and don't retry-storm a down AI service: for a
    // background poller the 5s interval IS the retry, so a failed poll surfaces
    // the error immediately and the next tick recovers on its own.
    refetchIntervalInBackground: false,
    retry: false,
  });
}

/** Count the FAILED jobs in a list (the nav badge's attention count). */
export function countFailedJobs(
  jobs: readonly GenerationJobRead[] | undefined,
): number {
  if (!jobs) return 0;
  return jobs.reduce((n, job) => (job.status === "failed" ? n + 1 : n), 0);
}

/**
 * The number of FAILED jobs for a book — the nav warning-badge count. Built on
 * {@link useJobs} (shared cache + poll), so the badge stays in sync with the
 * screen. Returns 0 while loading or on error (the badge hides honestly rather
 * than flashing a stale or misleading count).
 */
export function useFailedJobCount(bookId: string | undefined): number {
  const { data } = useJobs(bookId);
  return countFailedJobs(data);
}

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

/** Input for the continuity-check mutation (the active scene id + optional model). */
export interface CheckContinuityInput {
  sceneId: string;
  model?: string | null;
}

/**
 * Run a continuity check over a scene (B3). Resolves to structured warnings
 * (severity / message / entity) — analysis only, NEVER a manuscript write. The
 * Warnings tab fires this; errors surface via Query's `error` / `isError`
 * (never swallowed).
 */
export function useCheckContinuity(): UseMutationResult<
  ContinuityResult,
  Error,
  CheckContinuityInput
> {
  return useMutation({
    mutationFn: ({ sceneId, model }: CheckContinuityInput) =>
      checkContinuity(sceneId, model),
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
