import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { listRevisions, rejectRevision } from "@/lib/api/revisions";

/** Revisions are DOMAIN resources — they stay on the :8000 base, not the AI svc. */
const base = `${API_BASE_URL}/api/v1`;

describe("lib/api/revisions", () => {
  afterEach(() => server.resetHandlers());

  it("listRevisions targets the DOMAIN base and passes scene_id", async () => {
    let seenUrl: string | null = null;
    server.use(
      http.get(`${base}/revisions`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json([]);
      }),
    );
    await listRevisions("scene-1");
    expect(seenUrl).toContain(API_BASE_URL);
    expect(seenUrl).toContain("scene_id=scene-1");
  });

  it("listRevisions parses the validated list (drift throws)", async () => {
    const rows = await listRevisions("scene-1");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("content");
    expect(rows[0]).toHaveProperty("approved");
  });

  it("rejectRevision POSTs to /reject and parses the result", async () => {
    let seenMethod: string | null = null;
    server.use(
      http.post(`${base}/revisions/:id/reject`, ({ request, params }) => {
        seenMethod = request.method;
        return HttpResponse.json({
          id: String(params.id),
          scene_id: "scene-1",
          job_id: null,
          content: "x",
          approved: false,
          revision_type: "rewrite",
          model_name: null,
          prompt_version: null,
          created_at: "2026-06-15T11:00:00Z",
          updated_at: "2026-06-15T11:00:00Z",
        });
      }),
    );
    const rev = await rejectRevision("rev-x");
    expect(seenMethod).toBe("POST");
    expect(rev.id).toBe("rev-x");
    expect(rev.approved).toBe(false);
  });
});
