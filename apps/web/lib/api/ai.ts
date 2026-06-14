/**
 * Typed endpoint functions for the AI generation, Revision-approval, Snippet and
 * Model-listing endpoints (M5 AI flow). All AI generation goes through the real
 * backend ModelRouter/LiteLLM path; responses are validated with Zod before
 * reaching the UI, so a contract drift throws rather than slips through.
 *
 * Backend routes (`apps/api/app/api/v1/`, prefix `/api/v1`):
 *   GET  /ai/models                          → ModelsResponse
 *   POST /ai/rewrite                         → AIResult
 *   POST /ai/describe                        → AIDescribeResult
 *   POST /ai/generate-scene                  → AIResult
 *   POST /ai/write-continue                  → AIResult
 *   POST /ai/scenes/{scene_id}/summarize     → AIResult
 *   POST /revisions/{revision_id}/approve    → RevisionRead
 *   POST /projects/{project_id}/snippets     → SnippetRead (201)
 *
 * Human-in-the-loop: the AI endpoints persist the generation as a Revision
 * (`approved: false`). Acceptance is a SEPARATE explicit `approveRevision` call;
 * only then does the editor insert the text. The AI never writes unprompted.
 */
import { apiFetch } from "./client";
import { listBooks } from "./books";
import { listProjects } from "./projects";
import { currentGenerationParams } from "@/lib/stores/generation-settings-store";
import {
  aiDescribeResultSchema,
  aiResultSchema,
  modelsResponseSchema,
  revisionReadSchema,
  snippetCreateSchema,
  snippetReadSchema,
  type AIDescribeResult,
  type AIResult,
  type DescribeRequest,
  type GenerateSceneRequest,
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
  const data = await apiFetch<unknown>("/ai/models");
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
  });
  return aiResultSchema.parse(data);
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
