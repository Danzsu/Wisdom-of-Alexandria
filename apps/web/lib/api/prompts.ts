/**
 * Typed endpoint functions for the user-facing Prompt Library.
 *
 * Prompt templates are GLOBAL (workspace-wide, NO project scope) — see
 * `apps/api/app/api/v1/prompt_templates.py`, prefix `/prompt-templates` under
 * `/api/v1`:
 *   GET    /prompt-templates            → PromptTemplateRead[] (builtins first)
 *   GET    /prompt-templates/{id}       → PromptTemplateRead
 *   POST   /prompt-templates            → PromptTemplateRead (201; user template)
 *   PATCH  /prompt-templates/{id}       → PromptTemplateRead (403 on builtins)
 *   DELETE /prompt-templates/{id}       → 204 (403 on builtins)
 *
 * This is the browsable/creatable catalogue, NOT the internal AI system prompts
 * in `packages/prompts`.
 */
import { apiFetch } from "./client";
import {
  promptTemplateCreateSchema,
  promptTemplateListSchema,
  promptTemplateReadSchema,
  promptTemplateUpdateSchema,
  type PromptTemplateCreate,
  type PromptTemplateRead,
  type PromptTemplateUpdate,
} from "./types";

/** List all prompt templates (builtins first, then user templates). */
export async function listPromptTemplates(): Promise<PromptTemplateRead[]> {
  const data = await apiFetch<unknown>("/prompt-templates");
  return promptTemplateListSchema.parse(data);
}

/** Fetch a single prompt template by id. */
export async function getPromptTemplate(
  id: string,
): Promise<PromptTemplateRead> {
  const data = await apiFetch<unknown>(`/prompt-templates/${id}`);
  return promptTemplateReadSchema.parse(data);
}

/** Create a user prompt template. The payload is validated first. */
export async function createPromptTemplate(
  input: PromptTemplateCreate,
): Promise<PromptTemplateRead> {
  const body = promptTemplateCreateSchema.parse(input);
  const data = await apiFetch<unknown>("/prompt-templates", {
    method: "POST",
    body,
  });
  return promptTemplateReadSchema.parse(data);
}

/** Patch a user prompt template (builtins are 403-protected server-side). */
export async function updatePromptTemplate(
  id: string,
  patch: PromptTemplateUpdate,
): Promise<PromptTemplateRead> {
  const body = promptTemplateUpdateSchema.parse(patch);
  const data = await apiFetch<unknown>(`/prompt-templates/${id}`, {
    method: "PATCH",
    body,
  });
  return promptTemplateReadSchema.parse(data);
}

/** Delete a user prompt template (the backend answers 204). */
export async function deletePromptTemplate(id: string): Promise<void> {
  await apiFetch<unknown>(`/prompt-templates/${id}`, { method: "DELETE" });
}
