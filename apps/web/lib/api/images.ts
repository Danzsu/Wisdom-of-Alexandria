/**
 * Typed endpoint functions for the AI image-generation endpoints (Phase 1).
 *
 * Routing: the `/ai/images*` + `/ai/media` routes live on the SEPARATE AI
 * service (`NEXT_PUBLIC_AI_URL`, default :8001), so every call passes the
 * `baseUrl: AI_BASE_URL` override — same as `lib/api/ai.ts`. Responses are
 * validated with Zod before reaching the UI, so a contract drift throws rather
 * than slips through; errors surface via `apiFetch` (never swallowed).
 *
 *   AI service (:8001):
 *     POST   /ai/images                       → MediaAssetRead (202, generating)
 *     GET    /ai/images?entity_type=&entity_id= → MediaAssetRead[]
 *     POST   /ai/images/{id}/canonical        → MediaAssetRead
 *     DELETE /ai/images/{id}                  → 204
 *     GET    /ai/images/styles?entity_type=   → ImageStyleInfo[]
 *     GET    /ai/media/{id}[?thumb=1]         → image bytes (token via ?token=)
 */
import { z } from "zod";
import {
  AI_BASE_URL,
  API_PREFIX,
  TOKEN_STORAGE_KEY,
  apiFetch,
} from "./client";
import {
  imageStyleInfoSchema,
  mediaAssetReadSchema,
  type ImageStyleInfo,
  type MediaAssetRead,
} from "./image-types";

/** Validate a `MediaAssetRead[]` response (drift throws). */
const mediaAssetListSchema = z.array(mediaAssetReadSchema);
/** Validate an `ImageStyleInfo[]` response (drift throws). */
const imageStyleListSchema = z.array(imageStyleInfoSchema);

/** Input for {@link generateImage} (camelCase; serialised to snake_case). */
export interface GenerateImageInput {
  entityType: string;
  entityId: string;
  projectId: string;
  style: string;
  /** Optional explicit model override; backend falls back to the config default. */
  model?: string | null;
}

/**
 * Enqueue an image-generation job for a Codex Character/Location. Returns the
 * persisted `generating` MediaAsset (the backend answers 202); poll the entity
 * image list (or `GET /jobs/{id}`) until it flips to ready/failed. The body is
 * snake_case (entity_type / entity_id / project_id / style / model).
 */
export async function generateImage(
  input: GenerateImageInput,
): Promise<MediaAssetRead> {
  const data = await apiFetch<unknown>("/ai/images", {
    method: "POST",
    body: {
      entity_type: input.entityType,
      entity_id: input.entityId,
      project_id: input.projectId,
      style: input.style,
      model: input.model ?? null,
    },
    baseUrl: AI_BASE_URL,
  });
  return mediaAssetReadSchema.parse(data);
}

/** Params for {@link listImages}. */
export interface ListImagesParams {
  entityType: string;
  entityId: string;
}

/**
 * List an entity's generated images (newest-first). Both query params are
 * required by the backend. Errors throw via `apiFetch` — never swallowed.
 */
export async function listImages(
  params: ListImagesParams,
): Promise<MediaAssetRead[]> {
  const search = new URLSearchParams({
    entity_type: params.entityType,
    entity_id: params.entityId,
  });
  const data = await apiFetch<unknown>(`/ai/images?${search.toString()}`, {
    baseUrl: AI_BASE_URL,
  });
  return mediaAssetListSchema.parse(data);
}

/** Mark an image canonical (clears the flag on the entity's other images). */
export async function setCanonical(assetId: string): Promise<MediaAssetRead> {
  const data = await apiFetch<unknown>(
    `/ai/images/${encodeURIComponent(assetId)}/canonical`,
    { method: "POST", baseUrl: AI_BASE_URL },
  );
  return mediaAssetReadSchema.parse(data);
}

/** Delete an image (row + files). The backend answers 204; resolves to void. */
export async function deleteImage(assetId: string): Promise<void> {
  await apiFetch<unknown>(`/ai/images/${encodeURIComponent(assetId)}`, {
    method: "DELETE",
    baseUrl: AI_BASE_URL,
  });
}

/** List the available image-prompt style presets for an entity type. */
export async function listImageStyles(
  entityType: string,
): Promise<ImageStyleInfo[]> {
  const search = new URLSearchParams({ entity_type: entityType });
  const data = await apiFetch<unknown>(
    `/ai/images/styles?${search.toString()}`,
    { baseUrl: AI_BASE_URL },
  );
  return imageStyleListSchema.parse(data);
}

/**
 * Build the `<img src>` URL for a ready image's binary. `<img>` tags cannot send
 * an Authorization header, so the JWT rides along as a `?token=` query param
 * (the `/media` endpoint accepts EITHER the header or the query token). The
 * token is read the SAME way `client.ts` reads it from localStorage; on the
 * server (no `window`) it is omitted — the URL is only meaningful client-side.
 */
export function mediaUrl(
  assetId: string,
  opts?: { thumb?: boolean },
): string {
  const base = `${AI_BASE_URL}${API_PREFIX}/ai/media/${encodeURIComponent(assetId)}`;
  const search = new URLSearchParams();
  if (opts?.thumb) search.set("thumb", "1");

  if (typeof window !== "undefined") {
    try {
      const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (token) search.set("token", token);
    } catch {
      // localStorage unavailable (private mode / disabled) — omit the token;
      // the request then goes out unauthenticated (the backend answers 401).
    }
  }

  const qs = search.toString();
  return qs.length > 0 ? `${base}?${qs}` : base;
}
