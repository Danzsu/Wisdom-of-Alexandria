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
import { useMemo, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  approveRevision,
  checkContinuity,
  createSnippet,
  describe,
  generateChapter,
  generateScene,
  indexProjectAsync,
  listModels,
  research,
  resolveProjectIdForBook,
  rewrite,
  writeContinue,
  type ResearchInput,
} from "./ai";
import { getJob, listJobs } from "./jobs";
import { listScenes } from "./scenes";
import { listBeats } from "./beats";
import { queryKeys } from "./hooks";
import type {
  AIDescribeResult,
  AIResult,
  ChapterGenerateRequest,
  ContinuityResult,
  DescribeRequest,
  GenerateSceneRequest,
  GenerationJobRead,
  ModelsResponse,
  ResearchResult,
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
  job: (jobId: string) => ["jobs", "one", jobId] as const,
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
 * Count the ACTIVE jobs in a list — pending OR running. Drives the persistent
 * "AI dolgozik" indicator. Returns 0 for an empty/undefined list so the
 * indicator hides honestly (nothing in flight → nothing shown).
 */
export function countActiveJobs(
  jobs: readonly GenerationJobRead[] | undefined,
): number {
  if (!jobs) return 0;
  return jobs.reduce(
    (n, job) =>
      job.status === "running" || job.status === "pending" ? n + 1 : n,
    0,
  );
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
 * The number of ACTIVE (pending/running) jobs for a book — drives the persistent
 * "AI dolgozik" working indicator. Built on {@link useJobs} (shared cache +
 * poll). Returns 0 while loading or on error so the indicator hides honestly.
 */
export function useActiveJobCount(bookId: string | undefined): number {
  const { data } = useJobs(bookId);
  return countActiveJobs(data);
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

/* ---------------------------------------------------------------------------
 * Async RAG index rebuild (P1L-1) — enqueue + poll a background project re-index
 * ------------------------------------------------------------------------- */

/** How often the rebuild poll re-checks the job while it runs (ms). */
const REBUILD_POLL_INTERVAL_MS = 1_500;

/** What {@link useRebuildIndex} exposes to the Settings RAG-index card. */
export interface RebuildIndexState {
  /** Start a rebuild for the project (no-op until a project id is known). */
  trigger: () => void;
  /** The latest job view (pending → running → done/failed), or null pre-trigger. */
  job: GenerationJobRead | null;
  /** True from trigger until the job reaches a terminal (done/failed) state. */
  isRunning: boolean;
  /** Enqueue or poll error, whichever is active (null when healthy). */
  error: Error | null;
}

/**
 * Enqueue an async project RAG re-index and poll it to completion. The enqueue
 * returns a `pending` job; we then poll `GET /jobs/{id}` every ~1.5s until the
 * status is `done`/`failed`, at which point polling stops. The worker writes the
 * index counts (or `skipped_no_provider`) into `job.output_data`, which the card
 * renders. Errors surface via `error` — never swallowed.
 */
export function useRebuildIndex(
  projectId: string | undefined,
): RebuildIndexState {
  const [jobId, setJobId] = useState<string | null>(null);

  const enqueue = useMutation({
    mutationFn: () => indexProjectAsync(projectId as string),
    onSuccess: (job) => setJobId(job.id),
  });

  const poll = useQuery({
    queryKey: aiQueryKeys.job(jobId ?? "__none__"),
    queryFn: () => getJob(jobId as string),
    enabled: Boolean(jobId),
    // Poll until terminal, then stop (false). A background tab pauses polling.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "done" || status === "failed"
        ? false
        : REBUILD_POLL_INTERVAL_MS;
    },
    refetchIntervalInBackground: false,
  });

  // Freshest view: the poll once we have an id, else the enqueue's pending job.
  const job = poll.data ?? enqueue.data ?? null;
  const terminal = job?.status === "done" || job?.status === "failed";
  // `enqueue.isPending` must DOMINATE: on a SECOND trigger after a finished run,
  // `terminal` is still true (stale prior job) until the new id arrives, so
  // gating solely on `!terminal` would wrongly read false during the in-flight
  // enqueue. Once a job id exists we fall back to its non-terminal status.
  const isRunning = enqueue.isPending || (Boolean(jobId) && !terminal);

  return {
    trigger: () => {
      if (!projectId) return;
      // Clear the previous job so its terminal status/counts don't linger while
      // the new rebuild is enqueued (the new id arrives via onSuccess).
      setJobId(null);
      enqueue.mutate();
    },
    job,
    isRunning,
    error: enqueue.error ?? poll.error ?? null,
  };
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
 * Chapter automation (T4) — selection data + the generate mutation.
 * ------------------------------------------------------------------------- */

/**
 * One row of the "Fejezet generálása" selection list: a scene with the two facts
 * the modal's default-selection rules need — whether it is EMPTY (no manuscript
 * text) and how many beats it has. `selectableByDefault` collapses the rule
 * (empty AND has beats) so the component stays a pure renderer.
 */
export interface ChapterGenScene {
  id: string;
  title: string;
  /** True when the scene has no manuscript text (word_count 0 / empty content). */
  isEmpty: boolean;
  /** Word count (shown on a non-empty row). */
  wordCount: number;
  /** Number of beats — a scene with 0 beats cannot be generated. */
  beatCount: number;
  /** Pre-checked iff empty AND beatCount > 0 (the modal's default rule). */
  selectableByDefault: boolean;
}

/** What {@link useChapterScenesForGeneration} returns to the dialog. */
export interface ChapterScenesForGeneration {
  scenes: ChapterGenScene[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
}

/** A scene is EMPTY when it has no manuscript text (word_count 0 / blank content). */
function sceneIsEmpty(content: string | null, wordCount: number): boolean {
  return wordCount === 0 || (content ?? "").trim().length === 0;
}

/**
 * Load a chapter's scenes plus each scene's beat-count + empty-state, the data
 * the GenerateChapterDialog needs. Reuses the existing endpoints (`listScenes` +
 * `listBeats`) — no new backend shape: the scenes come from one query, then a
 * `useQueries` fan-out fetches each scene's beats (same pattern as
 * {@link useBookTree}). Beat lists are cached under the shared `sceneBeats` key,
 * so this shares cache with anywhere else that loads them. Disabled (no fetch)
 * until both a chapter id is supplied AND `enabled` is true, so the dialog only
 * fetches while open. Errors surface via `error`/`isError` (never swallowed).
 */
export function useChapterScenesForGeneration(
  chapterId: string | undefined,
  enabled: boolean,
): ChapterScenesForGeneration {
  const active = Boolean(chapterId) && enabled;

  const scenesQuery = useQuery({
    queryKey: queryKeys.chapterScenes(chapterId ?? "__none__"),
    queryFn: () => listScenes(chapterId as string),
    enabled: active,
  });

  const scenes = scenesQuery.data ?? [];

  const beatQueries = useQueries({
    queries: scenes.map((scene) => ({
      queryKey: queryKeys.sceneBeats(scene.id),
      queryFn: () => listBeats(scene.id),
      enabled: active,
    })),
  });

  const beatsLoading = beatQueries.some((q) => q.isLoading);
  const beatsError = beatQueries.find((q) => q.error)?.error ?? null;

  const rows = useMemo<ChapterGenScene[]>(
    () =>
      scenes.map((scene, index) => {
        const beatCount = beatQueries[index]?.data?.length ?? 0;
        const isEmpty = sceneIsEmpty(scene.content, scene.word_count);
        return {
          id: scene.id,
          title: scene.title,
          isEmpty,
          wordCount: scene.word_count,
          beatCount,
          selectableByDefault: isEmpty && beatCount > 0,
        };
      }),
    // beatQueries is a fresh array each render; key the memo on the resolved
    // beat-count signature so it only recomputes when the data actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scenes, beatQueries.map((q) => q.data?.length ?? -1).join(",")],
  );

  return {
    scenes: rows,
    isLoading:
      scenesQuery.isLoading || (scenes.length > 0 && active && beatsLoading),
    isError: scenesQuery.isError || beatQueries.some((q) => q.isError),
    error: (scenesQuery.error as Error | null) ?? (beatsError as Error | null),
  };
}

/** Input for the chapter-generation mutation (the chapter + the request body). */
export interface GenerateChapterInput {
  chapterId: string;
  body: ChapterGenerateRequest;
}

/**
 * Enqueue a chapter-generation job (T4). Resolves to the queued parent
 * `GenerationJob` (status `pending`); the caller toasts + closes the modal and
 * the job then surfaces live in the AI feladatok screen. Every generated scene
 * is a `Revision(approved=false)` — the manuscript only changes on an explicit
 * approve (HITL). Errors surface via the mutation's `error` (never swallowed).
 */
export function useGenerateChapter(): UseMutationResult<
  GenerationJobRead,
  Error,
  GenerateChapterInput
> {
  return useMutation({
    mutationFn: ({ chapterId, body }: GenerateChapterInput) =>
      generateChapter(chapterId, body),
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

/**
 * Ask a grounded Codex/manuscript question (RAG Q&A — the "Kutatás" screen).
 * Resolves to an answer + citation chips; NEVER a Revision (analysis only).
 * Errors surface via Query's `error` / `isError` — never swallowed.
 */
export function useResearch(): UseMutationResult<
  ResearchResult,
  Error,
  ResearchInput
> {
  return useMutation({ mutationFn: (input: ResearchInput) => research(input) });
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
