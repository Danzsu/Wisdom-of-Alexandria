/**
 * Typed endpoint functions for the Scenes resource.
 *
 * Scenes are nested under a chapter (`apps/api/app/api/v1/scenes.py`, prefix
 * `/chapters/{chapter_id}/scenes` under `/api/v1`):
 *   GET    /chapters/{cid}/scenes              → SceneRead[]
 *   POST   /chapters/{cid}/scenes              → SceneRead (201)
 *   GET    /chapters/{cid}/scenes/{sid}        → SceneRead
 *   PATCH  /chapters/{cid}/scenes/{sid}        → SceneRead
 *   DELETE /chapters/{cid}/scenes/{sid}        → 204
 *   POST   /chapters/{cid}/scenes/reorder      → SceneRead[] (body: { order })
 *   POST   /chapters/{cid}/scenes/{sid}/archive → SceneRead
 *
 * `word_count` is computed server-side from `content` on every create/update, so
 * the client never sends it — `SceneCreate`/`SceneUpdate` deliberately omit it.
 *
 * Responses are validated with Zod before reaching the UI, so a contract drift
 * surfaces as a thrown error rather than a silent shape mismatch.
 */
import { apiFetch } from "./client";
import {
  sceneCreateSchema,
  sceneListSchema,
  sceneReadSchema,
  sceneReorderSchema,
  sceneUpdateSchema,
  type SceneCreate,
  type SceneRead,
  type SceneReorder,
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

/** Create a scene under a chapter. The payload is validated against the contract. */
export async function createScene(
  chapterId: string,
  input: SceneCreate,
): Promise<SceneRead> {
  const body = sceneCreateSchema.parse(input);
  const data = await apiFetch<unknown>(`/chapters/${chapterId}/scenes`, {
    method: "POST",
    body,
  });
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

/** Delete a scene. */
export async function deleteScene(
  chapterId: string,
  sceneId: string,
): Promise<void> {
  await apiFetch<unknown>(`/chapters/${chapterId}/scenes/${sceneId}`, {
    method: "DELETE",
  });
}

/** Archive (soft-delete) a scene — sets status to "archived" server-side. */
export async function archiveScene(
  chapterId: string,
  sceneId: string,
): Promise<SceneRead> {
  const data = await apiFetch<unknown>(
    `/chapters/${chapterId}/scenes/${sceneId}/archive`,
    { method: "POST" },
  );
  return sceneReadSchema.parse(data);
}

/**
 * Reorder the scenes of a chapter. `order` is the full list of scene ids within
 * THIS chapter in their new sequence; the backend assigns `order_index` by
 * position and returns the re-sorted (non-archived) list. Cross-chapter moves
 * are not supported by the backend.
 */
export async function reorderScenes(
  chapterId: string,
  order: string[],
): Promise<SceneRead[]> {
  const body: SceneReorder = sceneReorderSchema.parse({ order });
  const data = await apiFetch<unknown>(`/chapters/${chapterId}/scenes/reorder`, {
    method: "POST",
    body,
  });
  return sceneListSchema.parse(data);
}
