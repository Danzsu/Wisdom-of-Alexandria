/**
 * Typed `fetch` wrapper for the Alexandria backend (FastAPI, base path
 * `/api/v1`).
 *
 * Design rules (M3):
 * - Base URL from `NEXT_PUBLIC_API_URL`, defaulting to `http://localhost:8000`.
 * - AI/provider/job calls target the split-out AI service (`NEXT_PUBLIC_AI_URL`,
 *   defaulting to `http://localhost:8001`) via a per-call `baseUrl` override —
 *   see {@link AI_BASE_URL}. The same JWT works on both services, so auth is
 *   identical regardless of base.
 * - JSON request/response by default; a `Bearer` token is attached when one is
 *   available (single-user local app — a real login screen is out of M3 scope).
 * - Errors are NEVER swallowed: a non-2xx response throws a typed `ApiError`
 *   carrying the status, a message and the parsed body; JSON parse failures on a
 *   non-empty response surface as errors too. The wrapper never returns
 *   `undefined` silently.
 */

/** Domain backend base origin (no trailing slash). Projects/books/chapters/
 * scenes/beats/codex/snippets/style-guide/relations/progressions/auth/exports +
 * revisions all live here. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * AI service base origin (no trailing slash). The Alexandria split moved the
 * `/ai/*`, `/providers/*` and `/jobs` routes onto a separate service. AI/provider
 * modules pass this as the {@link ApiFetchOptions.baseUrl} override; everything
 * else keeps hitting {@link API_BASE_URL}. The same JWT is accepted by both.
 */
export const AI_BASE_URL =
  process.env.NEXT_PUBLIC_AI_URL ?? "http://localhost:8001";

/** All v1 routes live under this prefix (see `apps/api/app/main.py`). */
export const API_PREFIX = "/api/v1";

/** localStorage key holding the dev bearer token (single-user local app). */
export const TOKEN_STORAGE_KEY = "woa-token";

/**
 * Typed error thrown for any non-OK response or transport/parse failure. Carries
 * the HTTP status (0 for transport/parse failures), a human-readable message and
 * the parsed error body when one was available.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Resolve the bearer token for the current call. On the client we read the
 * single-user token from `localStorage`; in any environment a build-time
 * `NEXT_PUBLIC_DEV_TOKEN` acts as the fallback. Returns `null` when none is set
 * (the request then goes out unauthenticated — the backend will answer 401,
 * which surfaces as an `ApiError`, never silently).
 */
export function getAuthToken(): string | null {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (stored) return stored;
    } catch {
      // localStorage can throw (private mode / disabled storage). Fall through
      // to the env fallback rather than failing the whole request here, but warn
      // so the fallback is visible (never log the token value itself).
      console.warn(
        "localStorage unavailable; falling back to NEXT_PUBLIC_DEV_TOKEN",
      );
    }
  }
  return process.env.NEXT_PUBLIC_DEV_TOKEN ?? null;
}

/** Options accepted by {@link apiFetch}, mirroring a subset of `RequestInit`. */
export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** JSON-serialisable request body. Serialised + `Content-Type` set. */
  body?: unknown;
  /** Extra headers merged over the defaults. */
  headers?: Record<string, string>;
  /** Abort signal forwarded to `fetch`. */
  signal?: AbortSignal;
  /**
   * Base origin to target instead of {@link API_BASE_URL}. AI/provider/job
   * modules pass {@link AI_BASE_URL} here so their calls reach the split-out AI
   * service; domain modules omit it and stay on the domain backend.
   */
  baseUrl?: string;
}

/** Build the absolute URL for an API path (path must start with `/`). */
function buildUrl(path: string, baseUrl: string = API_BASE_URL): string {
  const normalised = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${API_PREFIX}${normalised}`;
}

/**
 * Parse a response body as JSON, returning `null` for an empty body (e.g. a 204
 * No Content). Throws an `ApiError` when a non-empty body fails to parse — a
 * parse failure must never be hidden.
 */
async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(
      res.status,
      `A szerver válasza nem érvényes JSON (HTTP ${res.status}).`,
      text,
    );
  }
}

/** Extract a useful message from a FastAPI error body (`{ detail: ... }`). */
function messageFromBody(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string" && detail.length > 0) return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      // Pydantic 422 validation errors: array of `{ msg, loc }`.
      const first = detail[0] as { msg?: unknown };
      if (typeof first?.msg === "string") return first.msg;
    }
  }
  return `A kérés sikertelen (HTTP ${status}).`;
}

/**
 * Perform a typed JSON request against the API. Resolves with the parsed body
 * typed as `T`. Throws {@link ApiError} on any non-OK status, transport failure
 * or JSON parse failure — callers (and TanStack Query) always see the error.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, headers = {}, signal, baseUrl } = options;

  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  const token = getAuthToken();
  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  let serialisedBody: string | undefined;
  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
    serialisedBody = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, baseUrl), {
      method,
      headers: finalHeaders,
      body: serialisedBody,
      signal,
    });
  } catch (cause) {
    // Network / transport failure (CORS, server down, aborted). Surface it as a
    // typed error rather than letting an opaque TypeError bubble up.
    const message =
      cause instanceof Error
        ? cause.message
        : "Nem sikerült elérni a szervert.";
    throw new ApiError(0, message, cause);
  }

  const parsed = await parseJson(res);

  if (!res.ok) {
    throw new ApiError(res.status, messageFromBody(parsed, res.status), parsed);
  }

  return parsed as T;
}
