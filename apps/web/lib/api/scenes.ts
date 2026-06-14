/**
 * Typed endpoint functions for the Scenes resource.
 *
 * Scenes are nested under a chapter (`apps/api/app/api/v1/scenes.py`, prefix
 * `/chapters/{chapter_id}/scenes` under `/api/v1`):
 *   GET    /chapters/{cid}/scenes          → SceneRead[]
 *   GET    /chapters/{cid}/scenes/{sid}    → SceneRead
 *   PATCH  /chapters/{cid}/scenes/{sid}    → SceneRead
 *
 * `word_count` is computed server-side from `content` on every update, so the
 * client never sends it — `SceneUpdate` deliberately omits it.
 *
 * Responses are validated with Zod before reaching the UI, so a contract drift
 * surfaces as a thrown error rather than a silent shape mismatch.
 */
import { apiFetch } from "./client";
import {
  sceneListSchema,
  sceneReadSchema,
  sceneUpdateSchema,
  type SceneRead,
  type SceneUpdate,
} from "./types";

/** List the scenes belonging to a chapter (excludes archived by default). */
export async function listScenes(chapterId: string): Promise<SceneRead[]> {
  const data = await apiFetch<unknown>(`/chapters/${chapterId}/scenes`);
  return sceneListSchema.parse(data);
}

/** Fetch a single scene within a chapter. */
export async function getScene(
  chapterId: string,
  sceneId: string,
): Promise<SceneRead> {
  const data = await apiFetch<unknown>(
    `/chapters/${chapterId}/scenes/${sceneId}`,
  );
  return sceneReadSchema.parse(data);
}

/** Patch a scene. The payload is validated against the contract first. */
export async function updateScene(
  chapterId: string,
  sceneId: string,
  input: SceneUpdate,
): Promise<SceneRead> {
  const body = sceneUpdateSchema.parse(input);
  const data = await apiFetch<unknown>(
    `/chapters/${chapterId}/scenes/${sceneId}`,
    { method: "PATCH", body },
  );
  return sceneReadSchema.parse(data);
}
