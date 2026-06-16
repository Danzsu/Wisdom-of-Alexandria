/**
 * Typed endpoint functions for the CodexRelation resource (UX-3a relationship
 * graph). Relations are PROJECT-scoped (`apps/api/app/api/v1/codex_relations.py`,
 * prefix `/projects/{project_id}/codex-relations` under `/api/v1`):
 *   GET    /projects/{pid}/codex-relations            → CodexRelationRead[]
 *   POST   /projects/{pid}/codex-relations            → CodexRelationRead (201)
 *   GET    /projects/{pid}/codex-relations/{id}       → CodexRelationRead
 *   PATCH  /projects/{pid}/codex-relations/{id}       → CodexRelationRead
 *   DELETE /projects/{pid}/codex-relations/{id}       → 204
 *
 * A relation is a directed edge between two polymorphic codex entities; the
 * graph resolves each `{entity_type, entity_id}` to a label via the project's
 * codex entries. Each function validates its response with Zod — backend drift
 * throws rather than silently flowing a wrong shape into the graph.
 */
import { apiFetch } from "./client";
import {
  codexRelationListSchema,
  codexRelationReadSchema,
  codexRelationCreateSchema,
  codexRelationUpdateSchema,
  type CodexRelationCreate,
  type CodexRelationRead,
  type CodexRelationUpdate,
} from "./types";

/** List the relations belonging to a project. */
export async function listCodexRelations(
  projectId: string,
): Promise<CodexRelationRead[]> {
  const data = await apiFetch<unknown>(
    `/projects/${projectId}/codex-relations`,
  );
  return codexRelationListSchema.parse(data);
}

/** Create a relation under a project. The payload is validated first. */
export async function createCodexRelation(
  projectId: string,
  input: CodexRelationCreate,
): Promise<CodexRelationRead> {
  const body = codexRelationCreateSchema.parse(input);
  const data = await apiFetch<unknown>(
    `/projects/${projectId}/codex-relations`,
    { method: "POST", body },
  );
  return codexRelationReadSchema.parse(data);
}

/** Patch a relation's label (relation_type / description). */
export async function updateCodexRelation(
  projectId: string,
  relationId: string,
  patch: CodexRelationUpdate,
): Promise<CodexRelationRead> {
  const body = codexRelationUpdateSchema.parse(patch);
  const data = await apiFetch<unknown>(
    `/projects/${projectId}/codex-relations/${relationId}`,
    { method: "PATCH", body },
  );
  return codexRelationReadSchema.parse(data);
}

/** Delete a relation (the backend answers 204; apiFetch returns null). */
export async function deleteCodexRelation(
  projectId: string,
  relationId: string,
): Promise<void> {
  await apiFetch<unknown>(
    `/projects/${projectId}/codex-relations/${relationId}`,
    { method: "DELETE" },
  );
}
