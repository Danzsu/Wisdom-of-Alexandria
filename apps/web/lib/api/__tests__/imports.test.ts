import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL, ApiError } from "@/lib/api/client";
import { importDocx } from "@/lib/api/imports";

const base = `${API_BASE_URL}/api/v1`;

function makeDocxFile(name = "kezirat.docx"): File {
  return new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], name, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

// NOTE: `request.formData()` is unreliable in the jsdom + undici test stack
// (the multipart parser throws), so the handlers below inspect the raw request
// text instead. The raw multipart body deterministically contains the part
// names + the (text) title value, which is enough to prove the client sent a
// multipart upload with the file part and the title field.

describe("lib/api/imports.importDocx", () => {
  afterEach(() => server.resetHandlers());

  it("POSTs a multipart upload with the file part (and title) -> summary", async () => {
    const seen: {
      method: string;
      contentType: string | null;
      hasFilePart: boolean;
      hasTitle: boolean;
    }[] = [];

    server.use(
      http.post(`${base}/projects/:projectId/imports`, async ({ request }) => {
        const body = await request.text();
        seen.push({
          method: request.method,
          contentType: request.headers.get("content-type"),
          hasFilePart: body.includes('name="file"'),
          hasTitle: body.includes('name="title"') && body.includes("Saját cím"),
        });
        return HttpResponse.json({
          book_id: "book-123",
          title: "Saját cím",
          chapter_count: 2,
          scene_count: 3,
          word_count: 9,
        });
      }),
    );

    const result = await importDocx("proj-1", makeDocxFile(), "Saját cím");

    expect(result.book_id).toBe("book-123");
    expect(result.chapter_count).toBe(2);
    expect(result.scene_count).toBe(3);
    expect(seen).toHaveLength(1);
    expect(seen[0].method).toBe("POST");
    expect(seen[0].contentType).toContain("multipart/form-data");
    expect(seen[0].hasFilePart).toBe(true);
    expect(seen[0].hasTitle).toBe(true);
  });

  it("omits the title part when no title is given", async () => {
    let hasTitlePart = true;
    server.use(
      http.post(`${base}/projects/:projectId/imports`, async ({ request }) => {
        const body = await request.text();
        hasTitlePart = body.includes('name="title"');
        return HttpResponse.json({
          book_id: "b",
          title: "kezirat",
          chapter_count: 1,
          scene_count: 1,
          word_count: 4,
        });
      }),
    );

    await importDocx("proj-1", makeDocxFile());
    expect(hasTitlePart).toBe(false);
  });

  it("throws an ApiError carrying the server detail on a 502", async () => {
    server.use(
      http.post(`${base}/projects/:projectId/imports`, () =>
        HttpResponse.json(
          { detail: "pandoc failed to read the DOCX" },
          { status: 502 },
        ),
      ),
    );

    await expect(importDocx("proj-1", makeDocxFile())).rejects.toMatchObject({
      status: 502,
      message: "pandoc failed to read the DOCX",
    });
  });

  it("surfaces the 503 pandoc-missing detail", async () => {
    server.use(
      http.post(`${base}/projects/:projectId/imports`, () =>
        HttpResponse.json(
          { detail: "DOCX import requires pandoc; not available." },
          { status: 503 },
        ),
      ),
    );

    const error = await importDocx("proj-1", makeDocxFile()).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(503);
    expect((error as ApiError).message).toContain("pandoc");
  });
});
