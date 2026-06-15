/**
 * Typed endpoint functions + Zod schemas for the Provider resource (P1.1 —
 * provider/API-key configuration). Mirrors the backend contract
 * (`apps/api/app/api/v1/providers.py`, prefix `/providers` under `/api/v1`):
 *
 *   GET    /providers           (?enabled_only=true) → ProviderRead[]
 *   GET    /providers/{id}                            → ProviderRead
 *   POST   /providers                                 → ProviderRead (201)
 *   PATCH  /providers/{id}                            → ProviderRead
 *   DELETE /providers/{id}                            → 204
 *   POST   /providers/{id}/test                       → ProviderTestResult
 *   GET    /providers/{id}/models                     → ProviderModelsResponse
 *
 * SECURITY: `ProviderRead` NEVER carries the real api_key — only a masked
 * preview (`api_key_masked`, e.g. "••••3f8a") and a `has_key` boolean. The
 * frontend only ever displays the mask. The PLAINTEXT `api_key` is an INPUT-only
 * field on create/update; on edit it is OMITTED to keep the stored key, sent
 * only when the user enters a NEW one.
 *
 * Every response is validated with Zod before reaching the UI, so a contract
 * drift surfaces as a thrown error rather than a silent shape mismatch (same
 * discipline as `lib/api/types.ts` / `ai-types.ts`). Errors are never swallowed
 * — `apiFetch` throws a typed `ApiError`.
 */
import { z } from "zod";
import { apiFetch } from "./client";

/* ---------------------------------------------------------------------------
 * Provider types — the slugs the backend accepts. Ollama needs no api_key
 * (base_url only); the cloud types need an api_key.
 * ------------------------------------------------------------------------- */

/** The provider `type` slugs (mirrors the backend enum). */
export const PROVIDER_TYPES = [
  "ollama",
  "gemini",
  "anthropic",
  "openai",
  "openrouter",
  "custom",
] as const;

export type ProviderType = (typeof PROVIDER_TYPES)[number];

/** Provider types that DO NOT require an api_key (local / base-url driven). */
const KEYLESS_TYPES = new Set<ProviderType>(["ollama"]);

/** True when a provider type needs an api_key (every cloud type). */
export function providerTypeNeedsKey(type: ProviderType): boolean {
  return !KEYLESS_TYPES.has(type);
}

/** Narrow an arbitrary `type` string to a known ProviderType, or null. */
export function asProviderType(value: string): ProviderType | null {
  return (PROVIDER_TYPES as readonly string[]).includes(value)
    ? (value as ProviderType)
    : null;
}

/* ---------------------------------------------------------------------------
 * Zod schemas — mirror the backend Pydantic schemas exactly.
 * ------------------------------------------------------------------------- */

const idString = z.string().min(1);

const providerTypeSchema = z.enum(PROVIDER_TYPES);

/**
 * A provider as returned by the API (`ProviderRead`). `api_key_masked` is a
 * masked preview (or null when no key is stored); the real key is NEVER present
 * in this shape. `has_key` reflects whether a key is stored.
 */
export const providerReadSchema = z.object({
  id: idString,
  type: providerTypeSchema,
  label: z.string(),
  api_key_masked: z.string().nullable(),
  has_key: z.boolean(),
  base_url: z.string().nullable(),
  default_model: z.string().nullable(),
  enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ProviderRead = z.infer<typeof providerReadSchema>;

/**
 * Request body for creating a provider (`ProviderCreate`). `api_key` is the
 * PLAINTEXT key the backend encrypts/stores; it is INPUT-only and required for
 * cloud types (enforced in the form, not here, since the backend allows a
 * keyless create for ollama).
 */
export const providerCreateSchema = z.object({
  type: providerTypeSchema,
  label: z.string().min(1).max(255),
  api_key: z.string().min(1).optional(),
  base_url: z.string().max(2048).nullable().optional(),
  default_model: z.string().max(255).nullable().optional(),
  enabled: z.boolean().default(true),
});
/**
 * Use the Zod INPUT type for the request payload so the `enabled` default makes
 * the field optional for callers (it is filled by `.parse()` before the wire);
 * the parsed/wire shape is `z.output`.
 */
export type ProviderCreate = z.input<typeof providerCreateSchema>;

/**
 * Request body for patching a provider (`ProviderUpdate`). All fields optional.
 *
 * CRITICAL: OMIT `api_key` to KEEP the existing stored key; send it only to
 * REPLACE the key. The Cloud subpage's edit form leaves the key field blank to
 * keep, and only includes `api_key` when the user typed a new value.
 */
export const providerUpdateSchema = z.object({
  label: z.string().min(1).max(255).optional(),
  api_key: z.string().min(1).optional(),
  base_url: z.string().max(2048).nullable().optional(),
  default_model: z.string().max(255).nullable().optional(),
  enabled: z.boolean().optional(),
});
export type ProviderUpdate = z.infer<typeof providerUpdateSchema>;

/** Result of `POST /providers/{id}/test` (`ProviderTestResult`). */
export const providerTestResultSchema = z.object({
  ok: z.boolean(),
  detail: z.string(),
});
export type ProviderTestResult = z.infer<typeof providerTestResultSchema>;

/** One model offered by a provider (`GET /providers/{id}/models`). */
export const providerModelSchema = z.object({
  id: z.string().min(1),
  label: z.string(),
});
export type ProviderModel = z.infer<typeof providerModelSchema>;

/** Response of `GET /providers/{id}/models` (`ProviderModelsResponse`). */
export const providerModelsResponseSchema = z.object({
  models: z.array(providerModelSchema),
});
export type ProviderModelsResponse = z.infer<
  typeof providerModelsResponseSchema
>;

/** Array schema for the list endpoint. */
export const providerListSchema = z.array(providerReadSchema);

/* ---------------------------------------------------------------------------
 * Endpoint functions (each validates the response with Zod — drift throws).
 * ------------------------------------------------------------------------- */

/** List configured providers; pass `enabledOnly` to filter to enabled ones. */
export async function listProviders(
  enabledOnly = false,
): Promise<ProviderRead[]> {
  const query = enabledOnly ? "?enabled_only=true" : "";
  const data = await apiFetch<unknown>(`/providers${query}`);
  return providerListSchema.parse(data);
}

/** Fetch a single provider by id. */
export async function getProvider(providerId: string): Promise<ProviderRead> {
  const data = await apiFetch<unknown>(`/providers/${providerId}`);
  return providerReadSchema.parse(data);
}

/** Create a provider. The payload is validated first. */
export async function createProvider(
  input: ProviderCreate,
): Promise<ProviderRead> {
  const body = providerCreateSchema.parse(input);
  const data = await apiFetch<unknown>("/providers", { method: "POST", body });
  return providerReadSchema.parse(data);
}

/**
 * Patch a provider. The caller is responsible for OMITTING `api_key` when the
 * stored key should be kept (only include it to replace the key).
 */
export async function updateProvider(
  providerId: string,
  patch: ProviderUpdate,
): Promise<ProviderRead> {
  const body = providerUpdateSchema.parse(patch);
  const data = await apiFetch<unknown>(`/providers/${providerId}`, {
    method: "PATCH",
    body,
  });
  return providerReadSchema.parse(data);
}

/** Delete a provider (the backend answers 204; apiFetch returns null). */
export async function deleteProvider(providerId: string): Promise<void> {
  await apiFetch<unknown>(`/providers/${providerId}`, { method: "DELETE" });
}

/** Test the provider's credentials/connection (`POST /providers/{id}/test`). */
export async function testProvider(
  providerId: string,
): Promise<ProviderTestResult> {
  const data = await apiFetch<unknown>(`/providers/${providerId}/test`, {
    method: "POST",
  });
  return providerTestResultSchema.parse(data);
}

/** List the models the provider exposes (`GET /providers/{id}/models`). */
export async function listProviderModels(
  providerId: string,
): Promise<ProviderModelsResponse> {
  const data = await apiFetch<unknown>(`/providers/${providerId}/models`);
  return providerModelsResponseSchema.parse(data);
}
