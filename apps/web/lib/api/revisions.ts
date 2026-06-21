/**
 * Typed client for the Revision read/reject endpoints (the revision browser).
 *
 * Revisions are DOMAIN resources (the human-in-the-loop record of every AI
 * generation), so these stay on the domain backend (`NEXT_PUBLIC_API_URL`) — no
 * `baseUrl` override, unlike the `/ai/*` calls. Approve lives in `ai.ts`
 * (`approveRevision`) since it is the accept step shared with the editor flow.
 *
 *   Domain service (:8000):
 *     GET  /revisions?scene_id=          → RevisionRead[]
 *     POST /revisions/{id}/reject        → RevisionRead
 */
import { apiFetch } from "./client";
import { revisionReadSchema, type RevisionRead } from "./ai-types";
import { z } from "zod";

const revisionListSchema = z.array(revisionReadSchema);

/** List a scene's revisions (newest-first per the backend), drift-validated. */
export async function listRevisions(sceneId: string): Promise<RevisionRead[]> {
  const data = await apiFetch<unknown>(
    `/revisions?scene_id=${encodeURIComponent(sceneId)}`,
  );
  return revisionListSchema.parse(data);
}

/** Reject a revision (the AI suggestion is discarded; the scene is untouched). */
export async function rejectRevision(revisionId: string): Promise<RevisionRead> {
  const data = await apiFetch<unknown>(
    `/revisions/${encodeURIComponent(revisionId)}/reject`,
    { method: "POST" },
  );
  return revisionReadSchema.parse(data);
}
