/**
 * Typed endpoint functions for the Beats resource.
 *
 * Beats are nested under a scene (`apps/api/app/api/v1/beats.py`, prefix
 * `/scenes/{scene_id}/beats` under `/api/v1`):
 *   GET    /scenes/{sid}/beats            → BeatRead[]
 *   POST   /scenes/{sid}/beats            → BeatRead (201)
 *   PATCH  /scenes/{sid}/beats/{bid}      → BeatRead
 *   DELETE /scenes/{sid}/beats/{bid}      → 204
 *   POST   /scenes/{sid}/beats/reorder    → BeatRead[] (body: { order })
 *
 * Responses are validated with Zod before reaching the UI.
 */
import { apiFetch } from "./client";
import {
  beatCreateSchema,
  beatListSchema,
  beatReadSchema,
  beatReorderSchema,
  beatUpdateSchema,
  type BeatCreate,
  type BeatRead,
  type BeatReorder,
  type BeatUpdate,
} from "./types";

/** List the beats belonging to a scene (ordered by the backend). */
export async function listBeats(sceneId: string): Promise<BeatRead[]> {
  const data = await apiFetch<unknown>(`/scenes/${sceneId}/beats`);
  return beatListSchema.parse(data);
}

/** Create a beat under a scene. The payload is validated first. */
export async function createBeat(
  sceneId: string,
  input: BeatCreate,
): Promise<BeatRead> {
  const body = beatCreateSchema.parse(input);
  const data = await apiFetch<unknown>(`/scenes/${sceneId}/beats`, {
    method: "POST",
    body,
  });
  return beatReadSchema.parse(data);
}

/** Partially update one beat of a scene (description / type / notes / index). */
export async function updateBeat(
  sceneId: string,
  beatId: string,
  patch: BeatUpdate,
): Promise<BeatRead> {
  const body = beatUpdateSchema.parse(patch);
  const data = await apiFetch<unknown>(`/scenes/${sceneId}/beats/${beatId}`, {
    method: "PATCH",
    body,
  });
  return beatReadSchema.parse(data);
}

/** Delete one beat of a scene (204 — no body). */
export async function deleteBeat(
  sceneId: string,
  beatId: string,
): Promise<void> {
  await apiFetch<unknown>(`/scenes/${sceneId}/beats/${beatId}`, {
    method: "DELETE",
  });
}

/**
 * Reorder a scene's beats. `order` is the FULL list of the scene's beat ids in
 * their new sequence; the backend assigns `order_index` by position and
 * returns the re-sorted list.
 */
export async function reorderBeats(
  sceneId: string,
  order: string[],
): Promise<BeatRead[]> {
  const body: BeatReorder = beatReorderSchema.parse({ order });
  const data = await apiFetch<unknown>(`/scenes/${sceneId}/beats/reorder`, {
    method: "POST",
    body,
  });
  return beatListSchema.parse(data);
}
