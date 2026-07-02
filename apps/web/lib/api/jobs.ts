/**
 * Typed endpoint functions for the GenerationJob read/delete endpoints (B1 —
 * the live "AI feladatok" screen + the nav attention badge).
 *
 * Routing: jobs live on the SEPARATE AI service (`NEXT_PUBLIC_AI_URL`, default
 * :8001), so every call passes the `baseUrl: AI_BASE_URL` override — same as
 * `lib/api/ai.ts`. Responses are validated with Zod before reaching the UI, so a
 * contract drift throws rather than slips through.
 *
 *   AI service (:8001):
 *     GET    /jobs?book_id=&scene_id=&status=&limit=  → GenerationJobRead[]
 *     POST   /jobs/{job_id}/cancel                    → GenerationJobRead
 *     DELETE /jobs/{job_id}                           → 204
 *
 * Interactive single-scene AI stays SYNCHRONOUS (it persists each job inline);
 * this client READS the resulting job records (history + failure surfacing),
 * supports CANCELLING a queued/running background job (chapter/book
 * automation), and supports deleting a job row.
 */
import { AI_BASE_URL, apiFetch } from "./client";
import {
  generationJobReadSchema,
  type GenerationJobRead,
} from "./ai-types";
import { z } from "zod";

/** Validate a `GenerationJobRead[]` response (drift throws). */
const generationJobListSchema = z.array(generationJobReadSchema);

/** Filters accepted by {@link listJobs}. `bookId` scopes server-side (B1). */
export interface ListJobsParams {
  /** Scope to one book (jobs whose scene/chapter belongs to it). Required. */
  bookId: string;
  /** Optional status filter (pending / running / done / failed). */
  status?: string;
  /** Optional row cap (backend bounds it to 1..200; default 50). */
  limit?: number;
}

/**
 * List the generation jobs for a book, newest first. Builds the query string
 * from the supplied filters and validates the response. Errors (non-2xx /
 * transport / parse) throw via `apiFetch` — never swallowed.
 */
export async function listJobs(
  params: ListJobsParams,
): Promise<GenerationJobRead[]> {
  const search = new URLSearchParams({ book_id: params.bookId });
  if (params.status) search.set("status", params.status);
  if (params.limit !== undefined) search.set("limit", String(params.limit));
  const data = await apiFetch<unknown>(`/jobs?${search.toString()}`, {
    baseUrl: AI_BASE_URL,
  });
  return generationJobListSchema.parse(data);
}

/**
 * Fetch a single generation job by id (drift-validated). Used to POLL an async
 * job (e.g. the RAG index rebuild) until it reaches done/failed. Errors
 * (non-2xx / transport / parse) throw via `apiFetch` — never swallowed.
 */
export async function getJob(jobId: string): Promise<GenerationJobRead> {
  const data = await apiFetch<unknown>(`/jobs/${encodeURIComponent(jobId)}`, {
    baseUrl: AI_BASE_URL,
  });
  return generationJobReadSchema.parse(data);
}

/**
 * Cancel a generation job (`POST /jobs/{id}/cancel`). PENDING jobs flip to
 * `cancelled` immediately (best-effort RQ dequeue); RUNNING chapter/book jobs
 * stop cooperatively between scenes/chapters, KEEPING the already-generated
 * revisions. A job already in a terminal state answers 409 — surfaced as a
 * thrown error via `apiFetch`, never swallowed. Returns the updated job row.
 */
export async function cancelJob(jobId: string): Promise<GenerationJobRead> {
  const data = await apiFetch<unknown>(
    `/jobs/${encodeURIComponent(jobId)}/cancel`,
    { method: "POST", baseUrl: AI_BASE_URL },
  );
  return generationJobReadSchema.parse(data);
}

/** Delete a generation job (the backend answers 204; apiFetch returns null). */
export async function deleteJob(jobId: string): Promise<void> {
  await apiFetch<unknown>(`/jobs/${jobId}`, {
    method: "DELETE",
    baseUrl: AI_BASE_URL,
  });
}
