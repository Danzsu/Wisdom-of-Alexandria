import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import { generateCover, listCoverLayouts, listCoverStyles } from "@/lib/api/covers";
import { resetImageStore } from "@/test/msw/handlers";

const aiBase = `${AI_BASE_URL}/api/v1`;

describe("lib/api/covers", () => {
  beforeEach(() => resetImageStore());
  afterEach(() => server.resetHandlers());

  it("generateCover POSTs the cover body and returns the generating asset", async () => {
    let body: Record<string, unknown> = {};
    server.use(
      http.post(`${aiBase}/ai/covers`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { id: "cover-1", project_id: "p", entity_type: "cover", entity_id: "book-1",
            status: "generating", mime: "image/png", width: null, height: null,
            model_name: "gemini/x", style: "cover_fantasy", is_canonical: false,
            created_at: "2026-06-22T00:00:00Z" },
          { status: 202 },
        );
      }),
    );
    const asset = await generateCover({
      bookId: "book-1", artStyle: "cover_fantasy", layout: "classic_centered",
      title: "Fárosz", author: "Rácz D.",
    });
    expect(asset.entity_type).toBe("cover");
    expect(body).toMatchObject({
      book_id: "book-1", art_style: "cover_fantasy", layout: "classic_centered",
      title: "Fárosz", author: "Rácz D.",
      // omitted optionals must serialize as null (not undefined/absent),
      // matching the backend contract + images.ts.
      subtitle: null, model: null,
    });
  });

  it("lists cover styles and layouts", async () => {
    const styles = await listCoverStyles();
    expect(styles.some((s) => s.slug === "cover_fantasy")).toBe(true);
    const layouts = await listCoverLayouts();
    expect(layouts.some((l) => l.slug === "classic_centered")).toBe(true);
  });
});
