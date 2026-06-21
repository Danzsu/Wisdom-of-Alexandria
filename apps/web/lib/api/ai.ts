/**
 * Typed endpoint functions for the AI generation, Revision-approval, Snippet and
 * Model-listing endpoints (M5 AI flow). All AI generation goes through the real
 * backend ModelRouter/LiteLLM path; responses are validated with Zod before
 * reaching the UI, so a contract drift throws rather than slips through.
 *
 * Routing (Alexandria split): the `/ai/*` routes live on the SEPARATE AI service
 * (`NEXT_PUBLIC_AI_URL`, default :8001) and are targeted via the `baseUrl`
 * override. The Revision-approval and Snippet-create calls are DOMAIN endpoints
 * (human-in-the-loop approve + project-scoped snippets) and stay on the domain
 * backend (`NEXT_PUBLIC_API_URL`, default :8000) — they omit `baseUrl`.
 *
 *   AI service (:8001):
 *     GET  /ai/models                          → ModelsResponse
 *     POST /ai/rewrite                         → AIResult
 *     POST /ai/describe                        → AIDescribeResult
 *     POST /ai/generate-scene                  → AIResult
 *     POST /ai/write-continue                  → AIResult
 *     POST /ai/continuity                      → ContinuityResult
 *     POST /ai/scenes/{scene_id}/summarize     → AIResult
 *   Domain service (:8000):
 *     POST /revisions/{revision_id}/approve    → RevisionRead
 *     POST /projects/{project_id}/snippets     → SnippetRead (201)
 *
 * Human-in-the-loop: the AI endpoints persist the generation as a Revision
 * (`approved: false`). Acceptance is a SEPARATE explicit `approveRevision` call;
 * only then does the editor insert the text. The AI never writes unprompted.
 */
import { AI_BASE_URL, apiFetch } from "./client";
import { listBooks } from "./books";
import { listProjects } from "./projects";
import { currentGenerationParams } from "@/lib/stores/generation-settings-store";
import {
  aiDescribeResultSchema,
  aiResultSchema,
  continuityResultSchema,
  generationJobReadSchema,
  modelsResponseSchema,
  revisionReadSchema,
  snippetCreateSchema,
  snippetReadSchema,
  type AIDescribeResult,
  type AIResult,
  type ContinuityResult,
  type DescribeRequest,
  type GenerateSceneRequest,
  type GenerationJobRead,
  type ModelsResponse,
  type RevisionRead,
  type RewriteRequest,
  type SnippetCreate,
  type SnippetRead,
  type WriteContinueRequest,
} from "./ai-types";

/* ---------------------------------------------------------------------------
 * Models
 * ------------------------------------------------------------------------- */

/** List the AI models the backend is configured to use (config-driven). */
export async function listModels(): Promise<ModelsResponse> {
  const data = await apiFetch<unknown>("/ai/models", { baseUrl: AI_BASE_URL });
  return modelsResponseSchema.parse(data);
}

/* ---------------------------------------------------------------------------
 * AI generation (each persists a Revision + GenerationJob)
 *
 * Every generation body carries the client-persisted generation params
 * (temperature / max_tokens — M8 Beállítások). The store values are the base;
 * any param explicitly set on the caller's `input` wins. See
 * `lib/stores/generation-settings-store.ts` for why these live on the client.
 * ------------------------------------------------------------------------- */

/**
 * Merge the persisted generation params under the caller's input so the AI body
 * always carries `temperature` / `max_tokens`. Caller-supplied values override
 * the store (e.g. a future per-action override); store values fill the rest.
 */
function withGenerationParams<T extends object>(input: T): T {
  return { ...currentGenerationParams(), ...input };
}

/** Rewrite selected text with an instruction. */
export async function rewrite(input: RewriteRequest): Promise<AIResult> {
  const data = await apiFetch<unknown>("/ai/rewrite", {
    method: "POST",
    body: withGenerationParams(input),
    baseUrl: AI_BASE_URL,
  });
  return aiResultSchema.parse(data);
}

/** Sensory description for one or more channels (one revision per channel). */
export async function describe(
  input: DescribeRequest,
): Promise<AIDescribeResult> {
  const data = await apiFetch<unknown>("/ai/describe", {
    method: "POST",
    body: withGenerationParams(input),
    baseUrl: AI_BASE_URL,
  });
  return aiDescribeResultSchema.parse(data);
}

/** Generate a scene from a list of beats. */
export async function generateScene(
  input: GenerateSceneRequest,
): Promise<AIResult> {
  const data = await apiFetch<unknown>("/ai/generate-scene", {
    method: "POST",
    body: withGenerationParams(input),
    baseUrl: AI_BASE_URL,
  });
  return aiResultSchema.parse(data);
}

/** Continue writing the scene (auto mode). */
export async function writeContinue(
  input: WriteContinueRequest,
): Promise<AIResult> {
  const data = await apiFetch<unknown>("/ai/write-continue", {
    method: "POST",
    body: withGenerationParams(input),
    baseUrl: AI_BASE_URL,
  });
  return aiResultSchema.parse(data);
}

/**
 * Continuity-check a scene (B3). Returns STRUCTURED warnings (severity / message
 * / entity) — analysis, not generated content, so there is NO revision and
 * NOTHING is ever written to the manuscript. An empty `warnings` list is the
 * positive "no issues found" state. Generation params are intentionally NOT
 * attached: the body is `{scene_id, model?}` (the check has a fixed task).
 */
export async function checkContinuity(
  sceneId: string,
  model?: string | null,
): Promise<ContinuityResult> {
  const data = await apiFetch<unknown>("/ai/continuity", {
    method: "POST",
    body: { scene_id: sceneId, model: model ?? null },
    baseUrl: AI_BASE_URL,
  });
  return continuityResultSchema.parse(data);
}

/* ---------------------------------------------------------------------------
 * Async RAG index (P1L-1) — enqueue a background project re-index
 * ------------------------------------------------------------------------- */

/**
 * Enqueue an async project RAG re-index. Returns the queued GenerationJob
 * (status `pending`) immediately; poll {@link getJob} until it reaches
 * done/failed (the worker writes the index counts into `output_data`). The
 * worker resolves the embedding provider — when none is configured the job
 * completes as a no-op (`output_data.skipped_no_provider === true`), never an
 * error. `project_id` is sent as a query param (the endpoint's preferred form).
 */
export async function indexProjectAsync(
  projectId: string,
): Promise<GenerationJobRead> {
  const data = await apiFetch<unknown>(
    `/ai/index/async?project_id=${encodeURIComponent(projectId)}`,
    { method: "POST", baseUrl: AI_BASE_URL },
  );
  return generationJobReadSchema.parse(data);
}

/* ---------------------------------------------------------------------------
 * Revision approval (the human-in-the-loop accept step)
 * ------------------------------------------------------------------------- */

/** Approve a revision (sets `approved: true`). Called on the user's Elfogad. */
export async function approveRevision(
  revisionId: string,
): Promise<RevisionRead> {
  const data = await apiFetch<unknown>(`/revisions/${revisionId}/approve`, {
    method: "POST",
  });
  return revisionReadSchema.parse(data);
}

/* ---------------------------------------------------------------------------
 * Snippets (project-scoped) — the Star / "Snippet mentése" action
 * ------------------------------------------------------------------------- */

/** Create a snippet under a project. The payload is validated first. */
export async function createSnippet(
  projectId: string,
  input: SnippetCreate,
): Promise<SnippetRead> {
  const body = snippetCreateSchema.parse(input);
  const data = await apiFetch<unknown>(`/projects/${projectId}/snippets`, {
    method: "POST",
    body,
  });
  return snippetReadSchema.parse(data);
}

/**
 * Resolve the owning `project_id` for a `bookId`.
 *
 * Snippets are project-scoped but the Write route only carries `bookId`. There
 * is no `GET /books/{id}` (books are nested under a project), so we list
 * projects and find the one whose book list contains this book id. For the
 * single-user MVP corpus this is acceptable; it is cached by the hook layer.
 * Throws (never returns a wrong id) when no owning project is found.
 */
export async function resolveProjectIdForBook(
  bookId: string,
): Promise<string> {
  const projects = await listProjects();
  for (const project of projects) {
    const books = await listBooks(project.id);
    if (books.some((b) => b.id === bookId)) return project.id;
  }
  throw new Error(`Nem található projekt ehhez a könyvhöz: ${bookId}`);
}
