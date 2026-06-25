/**
 * Typed endpoint functions + Zod schemas for the Provider resource (P1.1 —
 * provider/API-key configuration). Mirrors the contract
 * (`apps/ai/app/api/v1/providers.py`, prefix `/providers` under `/api/v1`):
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
 *
 * ROUTING (Alexandria split): the `/providers/*` routes live on the SEPARATE AI
 * service (`NEXT_PUBLIC_AI_URL`, default :8001), so every call passes the
 * `baseUrl: AI_BASE_URL` override. The same JWT is accepted by both services.
 */
import { z } from "zod";
import type {
  Expect,
  MatchesContract,
  ProviderRead as GenProviderRead,
} from "@alexandria/shared";
import {
  AI_BASE_URL,
  API_PREFIX,
  ApiError,
  apiFetch,
  getAuthToken,
} from "./client";
import { idString } from "./schema-primitives";

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
  // The embedding model used for RAG indexing (B2a). Like the other model
  // slots it is a free, nullable string on the wire; not all providers expose
  // embeddings, so `null` is the common case.
  embedding_model: z.string().nullable(),
  // The image-generation model (Phase 1). A free, nullable string on the wire;
  // image generation is OPTIONAL so most providers leave this `null`.
  image_model: z.string().nullable(),
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
 * FE↔BE contract tie (Feature #4). `providerReadSchema`'s inferred shape is
 * bound to the OpenAPI-generated `ProviderRead` (apps/ai) from
 * `@alexandria/shared`. The FE narrows `type` to the {@link PROVIDER_TYPES}
 * union (the backend types it as a free string); the tie tolerates that
 * narrowing while pinning the key set, so a field add/remove/rename on the
 * backend fails `tsc`. Compile-time only; the Zod schema stays the runtime
 * validator. (Replaces the fixture drift-guard.)
 *
 * NOTE: binding this tie surfaced a REAL drift the old fixture-guard missed —
 * the backend `ProviderRead` gained `embedding_model` (B2a) but this schema had
 * not; `SameKeys` failed until the field was added above.
 * ------------------------------------------------------------------------- */
export type ProviderContractTies = [
  Expect<MatchesContract<z.infer<typeof providerReadSchema>, GenProviderRead>>,
];

/* ---------------------------------------------------------------------------
 * Endpoint functions (each validates the response with Zod — drift throws).
 * ------------------------------------------------------------------------- */

/** List configured providers; pass `enabledOnly` to filter to enabled ones. */
export async function listProviders(
  enabledOnly = false,
): Promise<ProviderRead[]> {
  const query = enabledOnly ? "?enabled_only=true" : "";
  const data = await apiFetch<unknown>(`/providers${query}`, {
    baseUrl: AI_BASE_URL,
  });
  return providerListSchema.parse(data);
}

/** Fetch a single provider by id. */
export async function getProvider(providerId: string): Promise<ProviderRead> {
  const data = await apiFetch<unknown>(`/providers/${providerId}`, {
    baseUrl: AI_BASE_URL,
  });
  return providerReadSchema.parse(data);
}

/** Create a provider. The payload is validated first. */
export async function createProvider(
  input: ProviderCreate,
): Promise<ProviderRead> {
  const body = providerCreateSchema.parse(input);
  const data = await apiFetch<unknown>("/providers", {
    method: "POST",
    body,
    baseUrl: AI_BASE_URL,
  });
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
    baseUrl: AI_BASE_URL,
  });
  return providerReadSchema.parse(data);
}

/** Delete a provider (the backend answers 204; apiFetch returns null). */
export async function deleteProvider(providerId: string): Promise<void> {
  await apiFetch<unknown>(`/providers/${providerId}`, {
    method: "DELETE",
    baseUrl: AI_BASE_URL,
  });
}

/** Test the provider's credentials/connection (`POST /providers/{id}/test`). */
export async function testProvider(
  providerId: string,
): Promise<ProviderTestResult> {
  const data = await apiFetch<unknown>(`/providers/${providerId}/test`, {
    method: "POST",
    baseUrl: AI_BASE_URL,
  });
  return providerTestResultSchema.parse(data);
}

/** List the models the provider exposes (`GET /providers/{id}/models`). */
export async function listProviderModels(
  providerId: string,
): Promise<ProviderModelsResponse> {
  const data = await apiFetch<unknown>(`/providers/${providerId}/models`, {
    baseUrl: AI_BASE_URL,
  });
  return providerModelsResponseSchema.parse(data);
}

/* ---------------------------------------------------------------------------
 * Model pull (Ollama download) — STREAMING.
 *
 * `POST /providers/{id}/models/pull` streams NDJSON progress: one JSON object
 * per line, ending with `{"status":"success"}`. We read the ReadableStream and
 * hand each parsed line to a callback so the UI can render a live progress bar.
 * A startup failure (non-Ollama provider → 400, Ollama down → 502) arrives as a
 * normal non-2xx JSON body and is thrown as an `ApiError` (never swallowed); a
 * mid-stream failure arrives in-band as a final `{"error": ...}` line.
 * ------------------------------------------------------------------------- */

/** One streamed progress line from the Ollama pull. */
export interface PullProgress {
  /** Ollama status text (e.g. "pulling manifest", "downloading", "success"). */
  status?: string;
  /** Bytes downloaded so far for the current layer (when downloading). */
  completed?: number;
  /** Total bytes for the current layer (when downloading). */
  total?: number;
  /** Set by the backend on a mid-stream failure (never alongside success). */
  error?: string;
}

/** Start the pull request, throwing a typed `ApiError` on transport failure. */
async function _startPull(
  providerId: string,
  model: string,
  signal?: AbortSignal,
): Promise<Response> {
  const url = `${AI_BASE_URL}${API_PREFIX}/providers/${providerId}/models/pull`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/x-ndjson",
  };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    return await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ model }),
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw cause;
    }
    throw new ApiError(
      0,
      "Nem sikerült elérni a szervert. Ellenőrizd a kapcsolatot.",
      cause,
    );
  }
}

/** Throw an `ApiError` carrying the FastAPI `{ detail }` from a non-2xx body. */
async function _throwPullStartError(res: Response): Promise<never> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error body — fall back to the status code */
  }
  const detail =
    body && typeof body === "object" && "detail" in body
      ? body.detail
      : null;
  const message =
    typeof detail === "string" && detail.length > 0
      ? detail
      : `A modell letöltése sikertelen (HTTP ${res.status}).`;
  throw new ApiError(res.status, message, body);
}

/** Parse one NDJSON line; skip blanks/garbage, throw on an in-band `error`. */
function _parsePullLine(line: string): PullProgress | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let parsed: PullProgress;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // A malformed line is a backend/transport glitch; skip it rather than
    // aborting the whole download.
    return null;
  }
  if (parsed.error) {
    // Mid-stream failure signalled in-band — surface it as an error.
    throw new ApiError(502, parsed.error, parsed);
  }
  return parsed;
}

/**
 * Pull (download) a model on a local Ollama provider, invoking `onProgress`
 * with each streamed NDJSON line. Resolves when the stream ends.
 *
 * Throws an {@link ApiError} on a startup failure (the backend answers a non-2xx
 * before streaming: 400 non-Ollama, 422 bad model name, 502/503 Ollama down).
 * If a progress line carries an `error` field (mid-stream failure), this throws
 * an `ApiError` too so the caller's `onError` path fires — a failure is never
 * silently treated as success.
 */
export async function pullModel(
  providerId: string,
  model: string,
  onProgress: (progress: PullProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await _startPull(providerId, model, signal);
  if (!res.ok) await _throwPullStartError(res);
  if (!res.body) return; // No stream on a 200 (shouldn't happen) — clean no-op.

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const handleLine = (line: string): void => {
    const parsed = _parsePullLine(line);
    if (parsed) onProgress(parsed);
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      handleLine(buffer.slice(0, newlineIndex));
      buffer = buffer.slice(newlineIndex + 1);
      newlineIndex = buffer.indexOf("\n");
    }
  }
  // Flush any trailing partial line (a final object without a newline).
  if (buffer.trim()) handleLine(buffer);
}
