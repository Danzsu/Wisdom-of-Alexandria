import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import { listJobs, deleteJob } from "@/lib/api/jobs";
import { countFailedJobs } from "@/lib/api/ai-hooks";
import { FAROSZ_BOOK, JOBS_FIXTURE } from "@/test/msw/fixtures";

/** AI service base — `/jobs` lives here after the Alexandria split. */
const aiBase = `${AI_BASE_URL}/api/v1`;

describe("lib/api/jobs", () => {
  afterEach(() => server.resetHandlers());

  it("listJobs targets the AI service base and passes book_id", async () => {
    let seenUrl: string | null = null;
    server.use(
      http.get(`${aiBase}/jobs`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json([]);
      }),
    );
    await listJobs({ bookId: FAROSZ_BOOK.id });
    expect(seenUrl).toContain(AI_BASE_URL);
    expect(seenUrl).toContain(`book_id=${FAROSZ_BOOK.id}`);
  });

  it("listJobs forwards optional status + limit filters", async () => {
    let seenUrl: string | null = null;
    server.use(
      http.get(`${aiBase}/jobs`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json([]);
      }),
    );
    await listJobs({ bookId: FAROSZ_BOOK.id, status: "failed", limit: 10 });
    expect(seenUrl).toContain("status=failed");
    expect(seenUrl).toContain("limit=10");
  });

  it("listJobs returns the validated, newest-first job list", async () => {
    const jobs = await listJobs({ bookId: FAROSZ_BOOK.id });
    expect(jobs).toHaveLength(JOBS_FIXTURE.length);
    // The failed job is first (created_at desc), mirroring the fixture order.
    expect(jobs[0]?.status).toBe("failed");
  });

  it("listJobs throws on a contract drift (missing required field)", async () => {
    server.use(
      http.get(`${aiBase}/jobs`, () =>
        HttpResponse.json([{ id: "x" /* missing job_type/status/... */ }]),
      ),
    );
    await expect(listJobs({ bookId: FAROSZ_BOOK.id })).rejects.toThrow();
  });

  it("deleteJob issues a DELETE against the AI base", async () => {
    let method: string | null = null;
    let seenUrl: string | null = null;
    server.use(
      http.delete(`${aiBase}/jobs/:jobId`, ({ request }) => {
        method = request.method;
        seenUrl = request.url;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await deleteJob("job-failed-1");
    expect(method).toBe("DELETE");
    expect(seenUrl).toBe(`${aiBase}/jobs/job-failed-1`);
  });

  it("countFailedJobs counts only failed jobs (and 0 for undefined)", () => {
    expect(countFailedJobs(undefined)).toBe(0);
    expect(countFailedJobs(JOBS_FIXTURE)).toBe(1);
    expect(countFailedJobs(JOBS_FIXTURE.filter((j) => j.status !== "failed"))).toBe(
      0,
    );
  });
});
