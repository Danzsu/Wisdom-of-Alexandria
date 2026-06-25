/**
 * Typed endpoint function for the current-user identity.
 *
 * Backend route (`apps/api/app/api/v1/auth.py`, prefix `/auth` under `/api/v1`):
 *   GET /auth/me → MeRead (auth-protected)
 *
 * The response is validated with Zod before reaching the UI, so a contract
 * drift surfaces as a thrown error rather than a silent shape mismatch.
 */
import { apiFetch } from "./client";
import { meReadSchema, type MeRead } from "./types";

/** Fetch the authenticated user's identity (username + derived fields). */
export async function getMe(): Promise<MeRead> {
  const data = await apiFetch<unknown>("/auth/me");
  return meReadSchema.parse(data);
}
