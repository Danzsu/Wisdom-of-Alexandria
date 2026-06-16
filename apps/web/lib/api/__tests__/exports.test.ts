import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL, API_BASE_URL, ApiError } from "@/lib/api/client";
import { exportBook } from "@/lib/api/exports";
import { downloadBlob } from "@/lib/api/export-hooks";
import { rewrite } from "@/lib/api/ai";
import {
  DEFAULT_MAX_TOKENS,
  DEFAULT_TEMPERATURE,
  useGenerationSettings,
} from "@/lib/stores/generation-settings-store";
import { FAROSZ_BOOK } from "@/test/msw/fixtures";

/** Domain base — the export endpoint stays here after the Alexandria split. */
const base = `${API_BASE_URL}/api/v1`;
/** AI service base — the `/ai/rewrite` generation-params probe lives here. */
const aiBase = `${AI_BASE_URL}/api/v1`;

describe("lib/api/exports", () => {
  afterEach(() => server.resetHandlers());

  it("POSTs to /books/{id}/exports and returns the blob + the server filename", async () => {
    const seen: {
      method: string;
      bookId: string;
      scope: string | null;
      format: string | null;
    }[] = [];
    server.use(
      http.post(`${base}/books/:bookId/exports`, ({ request, params }) => {
        const url = new URL(request.url);
        seen.push({
          method: request.method,
          bookId: String(params.bookId),
          scope: url.searchParams.get("scope"),
          format: url.searchParams.get("format"),
        });
        return new HttpResponse("# A Fárosz őrzője\n", {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": 'attachment; filename="a_farosz_orzoje.md"',
          },
        });
      }),
    );

    const result = await exportBook(FAROSZ_BOOK.id, FAROSZ_BOOK.title);

    // Defaults to whole-book scope + md format (no target_id).
    expect(seen).toEqual([
      { method: "POST", bookId: FAROSZ_BOOK.id, scope: "book", format: "md" },
    ]);
    expect(await result.blob.text()).toContain("# A Fárosz őrzője");
    // Honors the server-supplied ASCII filename.
    expect(result.filename).toBe("a_farosz_orzoje.md");
  });

  it("forwards format=docx and tags the blob with the docx MIME + .docx name", async () => {
    let url: URL | null = null;
    // A tiny ZIP-magic byte payload stands in for a real docx.
    const docxBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
    server.use(
      http.post(`${base}/books/:bookId/exports`, ({ request }) => {
        url = new URL(request.url);
        return new HttpResponse(docxBytes, {
          status: 200,
          headers: {
            "Content-Type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "Content-Disposition": 'attachment; filename="a_farosz_orzoje.docx"',
          },
        });
      }),
    );

    const result = await exportBook(FAROSZ_BOOK.id, FAROSZ_BOOK.title, {
      format: "docx",
    });

    expect(url!.searchParams.get("format")).toBe("docx");
    expect(result.filename).toBe("a_farosz_orzoje.docx");
    expect(result.blob.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    // The binary bytes round-trip intact (ZIP magic preserved).
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 2))).toEqual([0x50, 0x4b]);
  });

  it("forwards format=epub and the epub MIME, building the .epub fallback name", async () => {
    let url: URL | null = null;
    const epubBytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    server.use(
      http.post(`${base}/books/:bookId/exports`, ({ request }) => {
        url = new URL(request.url);
        // No Content-Disposition -> client builds the name with the .epub ext.
        return new HttpResponse(epubBytes, {
          status: 200,
          headers: { "Content-Type": "application/epub+zip" },
        });
      }),
    );

    const result = await exportBook(FAROSZ_BOOK.id, "A Fárosz őrzője", {
      format: "epub",
    });

    expect(url!.searchParams.get("format")).toBe("epub");
    expect(result.blob.type).toBe("application/epub+zip");
    // Client-side fallback name carries the epub extension.
    expect(result.filename).toBe("a_farosz_orzoje.epub");
  });

  it("forwards scope=chapter + target_id for a chapter export", async () => {
    let url: URL | null = null;
    server.use(
      http.post(`${base}/books/:bookId/exports`, ({ request }) => {
        url = new URL(request.url);
        return new HttpResponse("## 1. Prológus\n", {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": 'attachment; filename="prologus.md"',
          },
        });
      }),
    );

    const result = await exportBook(FAROSZ_BOOK.id, "Prológus", {
      scope: "chapter",
      targetId: "c1111111-1111-1111-1111-111111111111",
    });

    expect(url).not.toBeNull();
    expect(url!.searchParams.get("scope")).toBe("chapter");
    expect(url!.searchParams.get("target_id")).toBe(
      "c1111111-1111-1111-1111-111111111111",
    );
    expect(result.filename).toBe("prologus.md");
  });

  it("forwards scope=scene + target_id for a scene export", async () => {
    let url: URL | null = null;
    server.use(
      http.post(`${base}/books/:bookId/exports`, ({ request }) => {
        url = new URL(request.url);
        return new HttpResponse("### 1.1 Reggel\n", { status: 200 });
      }),
    );

    await exportBook(FAROSZ_BOOK.id, "Reggel", {
      scope: "scene",
      targetId: "5ce11111-1111-1111-1111-111111111111",
    });

    expect(url).not.toBeNull();
    expect(url!.searchParams.get("scope")).toBe("scene");
    expect(url!.searchParams.get("target_id")).toBe(
      "5ce11111-1111-1111-1111-111111111111",
    );
  });

  it("falls back to the client ASCII-fold filename when the header is absent", async () => {
    server.use(
      http.post(`${base}/books/:bookId/exports`, () =>
        new HttpResponse("# x\n", {
          status: 200,
          headers: { "Content-Type": "text/markdown" },
        }),
      ),
    );

    const result = await exportBook(FAROSZ_BOOK.id, "A Fárosz őrzője");
    // Built client-side via the Hungarian slugify util.
    expect(result.filename).toBe("a_farosz_orzoje.md");
  });

  it("throws an ApiError on a 404 (never swallowed)", async () => {
    server.use(
      http.post(`${base}/books/:bookId/exports`, () =>
        HttpResponse.json({ detail: "Book not found" }, { status: 404 }),
      ),
    );
    await expect(exportBook("unknown", "x")).rejects.toBeInstanceOf(ApiError);
  });

  it("surfaces the pandoc-missing 503 detail as an ApiError (no swallow)", async () => {
    server.use(
      http.post(`${base}/books/:bookId/exports`, () =>
        HttpResponse.json(
          { detail: "DOCX/EPUB export requires pandoc; not available." },
          { status: 503 },
        ),
      ),
    );
    await expect(
      exportBook(FAROSZ_BOOK.id, "x", { format: "docx" }),
    ).rejects.toMatchObject({ status: 503 });
  });
});

describe("downloadBlob", () => {
  it("creates + revokes the object URL (no leak) and clicks an anchor", () => {
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:woa-test");
    const revokeSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    downloadBlob(new Blob(["# hello\n"], { type: "text/markdown" }), "out.md");

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    // The object URL is ALWAYS revoked (cleanup) — assert it happened.
    expect(revokeSpy).toHaveBeenCalledWith("blob:woa-test");

    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });

  it("revokes the object URL even when the anchor click throws", () => {
    const createSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:woa-throw");
    const revokeSpy = vi
      .spyOn(URL, "revokeObjectURL")
      .mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {
        throw new Error("click boom");
      });

    expect(() =>
      downloadBlob(new Blob(["x"]), "out.md"),
    ).toThrow("click boom");
    // Cleanup still ran despite the throw.
    expect(revokeSpy).toHaveBeenCalledWith("blob:woa-throw");

    createSpy.mockRestore();
    revokeSpy.mockRestore();
    clickSpy.mockRestore();
  });
});

describe("AI calls carry the persisted generation params", () => {
  afterEach(() => {
    server.resetHandlers();
    useGenerationSettings.setState({
      temperature: DEFAULT_TEMPERATURE,
      maxTokens: DEFAULT_MAX_TOKENS,
    });
  });

  it("attaches the store's temperature + max_tokens to the rewrite body", async () => {
    useGenerationSettings.getState().setTemperature(1.3);
    useGenerationSettings.getState().setMaxTokens(1234);

    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${aiBase}/ai/rewrite`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          revision: {
            id: "r1",
            scene_id: null,
            job_id: null,
            content: "ok",
            approved: false,
            revision_type: "rewrite",
            model_name: "ollama/llama3.2",
            prompt_version: "1.0",
            created_at: "2026-06-15T00:00:00Z",
            updated_at: "2026-06-15T00:00:00Z",
          },
          job: {
            id: "j1",
            scene_id: null,
            chapter_id: null,
            job_type: "rewrite",
            status: "done",
            model_name: "ollama/llama3.2",
            prompt_version: "1.0",
            input_data: {},
            output_data: {},
            error_message: null,
            created_at: "2026-06-15T00:00:00Z",
            updated_at: "2026-06-15T00:00:00Z",
          },
        });
      }),
    );

    await rewrite({ selected_text: "x", instruction: "y" });

    expect(body.temperature).toBeCloseTo(1.3);
    expect(body.max_tokens).toBe(1234);
  });
});
