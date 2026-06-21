/**
 * Typed endpoint functions for the Plotline resource (Plotline-b
 * Cselekményszálak). Plotlines are PROJECT-scoped
 * (`apps/api/app/api/v1/plotlines.py`, prefix `/projects/{project_id}/plotlines`
 * under `/api/v1`):
 *   GET    /projects/{pid}/plotlines            → PlotlineRead[]
 *   POST   /projects/{pid}/plotlines            → PlotlineRead (201)
 *   GET    /projects/{pid}/plotlines/{id}       → PlotlineRead
 *   PATCH  /projects/{pid}/plotlines/{id}       → PlotlineRead
 *   DELETE /projects/{pid}/plotlines/{id}       → 204
 *
 * Scene attach/detach/list lives on a FLAT link router (a plotline already pins
 * its project), mirroring the backend's `scene_links_router`:
 *   GET    /plotlines/{id}/scenes               → PlotlineSceneRead[]
 *   POST   /plotlines/{id}/scenes               → PlotlineSceneRead (201)
 *   DELETE /plotlines/{id}/scenes/{scene_id}    → 204
 *
 * A cross-project scene/book attach is rejected server-side with 400; the error
 * propagates through `apiFetch` (never swallowed). Each function validates its
 * response with Zod — backend drift throws rather than silently flowing a wrong
 * shape into the screen.
 */
import { apiFetch } from "./client";
import {
  plotlineListSchema,
  plotlineReadSchema,
  plotlineCreateSchema,
  plotlineUpdateSchema,
  plotlineSceneListSchema,
  plotlineSceneReadSchema,
  plotlineSceneCreateSchema,
  type PlotlineCreate,
  type PlotlineRead,
  type PlotlineSceneCreate,
  type PlotlineSceneRead,
  type PlotlineUpdate,
} from "./types";

/** List the plotlines belonging to a project. */
export async function listPlotlines(
  projectId: string,
): Promise<PlotlineRead[]> {
  const data = await apiFetch<unknown>(`/projects/${projectId}/plotlines`);
  return plotlineListSchema.parse(data);
}

/** Create a plotline under a project. The payload is validated first. */
export async function createPlotline(
  projectId: string,
  input: PlotlineCreate,
): Promise<PlotlineRead> {
  const body = plotlineCreateSchema.parse(input);
  const data = await apiFetch<unknown>(`/projects/${projectId}/plotlines`, {
    method: "POST",
    body,
  });
  return plotlineReadSchema.parse(data);
}

/** Patch a plotline (title / type / status / description / book scope / order). */
export async function updatePlotline(
  projectId: string,
  plotlineId: string,
  patch: PlotlineUpdate,
): Promise<PlotlineRead> {
  const body = plotlineUpdateSchema.parse(patch);
  const data = await apiFetch<unknown>(
    `/projects/${projectId}/plotlines/${plotlineId}`,
    { method: "PATCH", body },
  );
  return plotlineReadSchema.parse(data);
}

/** Delete a plotline (the backend answers 204; apiFetch returns null). */
export async function deletePlotline(
  projectId: string,
  plotlineId: string,
): Promise<void> {
  await apiFetch<unknown>(`/projects/${projectId}/plotlines/${plotlineId}`, {
    method: "DELETE",
  });
}

/** List the scenes attached to a plotline (flat link router — no project prefix). */
export async function listPlotlineScenes(
  plotlineId: string,
): Promise<PlotlineSceneRead[]> {
  const data = await apiFetch<unknown>(`/plotlines/${plotlineId}/scenes`);
  return plotlineSceneListSchema.parse(data);
}

/**
 * Attach a scene to a plotline. A cross-project scene → 400, surfaced via the
 * thrown `apiFetch` error (never swallowed).
 */
export async function attachScene(
  plotlineId: string,
  input: PlotlineSceneCreate,
): Promise<PlotlineSceneRead> {
  const body = plotlineSceneCreateSchema.parse(input);
  const data = await apiFetch<unknown>(`/plotlines/${plotlineId}/scenes`, {
    method: "POST",
    body,
  });
  return plotlineSceneReadSchema.parse(data);
}

/** Detach a scene from a plotline (by scene id; backend answers 204). */
export async function detachScene(
  plotlineId: string,
  sceneId: string,
): Promise<void> {
  await apiFetch<unknown>(`/plotlines/${plotlineId}/scenes/${sceneId}`, {
    method: "DELETE",
  });
}
