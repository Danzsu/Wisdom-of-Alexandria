/**
 * Tests for the project JSON backup/restore client (Feature #5).
 *
 * exportBackup: GETs the backup, triggers a Blob download (object URL created +
 *   revoked), returns the server's Content-Disposition filename.
 * restoreBackup: POSTs a multipart .json upload, parses the RestoreSummary.
 * Errors (404 / 422) surface as a thrown ApiError carrying the server detail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL, ApiError } from "@/lib/api/client";
import { exportBackup, restoreBackup } from "@/lib/api/backups";

const base = `${API_BASE_URL}/api/v1`;

function makeBackupFile(contents: string, name = "backup.json"): File {
  return new File([contents], name, { type: "application/json" });
}

describe("lib/api/backups.exportBackup", () => {
  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:woa-test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  it("downloads the backup and returns the server filename", async () => {
    const filename = await exportBackup("proj-1");
    expect(filename).toBe("mentett_projekt-backup.json");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("falls back to <projectId>-backup.json when no Content-Disposition", async () => {
    server.use(
      http.get(`${base}/projects/:projectId/backup`, () =>
        HttpResponse.json({ version: 1, project: { title: "x" } }),
      ),
    );
    const filename = await exportBackup("proj-77");
    expect(filename).toBe("proj-77-backup.json");
  });

  it("throws ApiError with the server detail on a 404", async () => {
    server.use(
      http.get(`${base}/projects/:projectId/backup`, () =>
        HttpResponse.json({ detail: "Project not found" }, { status: 404 }),
      ),
    );
    await expect(exportBackup("missing")).rejects.toMatchObject({
      status: 404,
      message: "Project not found",
    });
    await expect(exportBackup("missing")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("lib/api/backups.restoreBackup", () => {
  afterEach(() => server.resetHandlers());

  it("POSTs a multipart upload and parses the RestoreSummary", async () => {
    const seen: { method: string; contentType: string | null; hasFile: boolean }[] =
      [];
    server.use(
      http.post(`${base}/projects/restore`, async ({ request }) => {
        const body = await request.text();
        seen.push({
          method: request.method,
          contentType: request.headers.get("content-type"),
          hasFile: body.includes('name="file"'),
        });
        return HttpResponse.json(
          {
            project_id: "restored-1",
            title: "Visszaállított",
            series_count: 0,
            book_count: 1,
            chapter_count: 1,
            scene_count: 1,
            beat_count: 0,
            codex_entry_count: 0,
            character_count: 0,
            location_count: 0,
            worldbuilding_count: 0,
            snippet_count: 0,
            style_guide_count: 0,
            codex_relation_count: 0,
            codex_progression_count: 0,
          },
          { status: 201 },
        );
      }),
    );

    const summary = await restoreBackup(
      makeBackupFile('{"version":1,"project":{"title":"x"}}'),
    );
    expect(summary.project_id).toBe("restored-1");
    expect(summary.book_count).toBe(1);
    expect(seen).toHaveLength(1);
    expect(seen[0].method).toBe("POST");
    expect(seen[0].contentType).toContain("multipart/form-data");
    expect(seen[0].hasFile).toBe(true);
  });

  it("throws ApiError with the server detail on a 422", async () => {
    server.use(
      http.post(`${base}/projects/restore`, () =>
        HttpResponse.json(
          { detail: "Unsupported backup version: 999" },
          { status: 422 },
        ),
      ),
    );
    await expect(
      restoreBackup(makeBackupFile('{"version":999}')),
    ).rejects.toMatchObject({ status: 422, message: "Unsupported backup version: 999" });
  });
});
