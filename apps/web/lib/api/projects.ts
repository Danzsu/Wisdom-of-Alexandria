/**
 * Typed endpoint functions for the Projects resource.
 *
 * Backend routes (`apps/api/app/api/v1/projects.py`, prefix `/projects` under
 * `/api/v1`):
 *   GET    /projects            → ProjectRead[]
 *   GET    /projects/{id}       → ProjectRead
 *   POST   /projects            → ProjectRead (201)
 *
 * Responses are validated with Zod before reaching the UI, so a contract drift
 * surfaces as a thrown error rather than a silent shape mismatch.
 */
import { apiFetch } from "./client";
import {
  projectCreateSchema,
  projectListSchema,
  projectReadSchema,
  type ProjectCreate,
  type ProjectRead,
} from "./types";

/** List all projects (newest-first ordering is the backend's concern). */
export async function listProjects(): Promise<ProjectRead[]> {
  const data = await apiFetch<unknown>("/projects");
  return projectListSchema.parse(data);
}

/** Fetch a single project by id. */
export async function getProject(id: string): Promise<ProjectRead> {
  const data = await apiFetch<unknown>(`/projects/${id}`);
  return projectReadSchema.parse(data);
}

/** Create a project. The payload is validated against the contract first. */
export async function createProject(
  input: ProjectCreate,
): Promise<ProjectRead> {
  const body = projectCreateSchema.parse(input);
  const data = await apiFetch<unknown>("/projects", {
    method: "POST",
    body,
  });
  return projectReadSchema.parse(data);
}
