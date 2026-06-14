/**
 * Typed endpoint functions for the Beats resource.
 *
 * Beats are nested under a scene (`apps/api/app/api/v1/beats.py`, prefix
 * `/scenes/{scene_id}/beats` under `/api/v1`):
 *   GET    /scenes/{sid}/beats        → BeatRead[]
 *   POST   /scenes/{sid}/beats        → BeatRead (201)
 *
 * Responses are validated with Zod before reaching the UI.
 */
import { apiFetch } from "./client";
import {
  beatCreateSchema,
  beatListSchema,
  beatReadSchema,
  type BeatCreate,
  type BeatRead,
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
