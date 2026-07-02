import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL, TOKEN_STORAGE_KEY } from "@/lib/api/client";
import {
  deleteImage,
  fetchMediaBlob,
  generateImage,
  listImageStyles,
  listImages,
  setCanonical,
} from "@/lib/api/images";
import { resetImageStore } from "@/test/msw/handlers";
import { FAROSZ_PROJECT, makeMediaAsset } from "@/test/msw/fixtures";

/** AI service base — `/ai/images*` + `/ai/media` live here. */
const aiBase = `${AI_BASE_URL}/api/v1`;

describe("lib/api/images", () => {
  beforeEach(() => resetImageStore());
  afterEach(() => server.resetHandlers());

  it("generateImage POSTs to the AI base with a snake_case body + parses", async () => {
    let seenUrl: string | null = null;
    let seenBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${aiBase}/ai/images`, async ({ request }) => {
        seenUrl = request.url;
        seenBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeMediaAsset("generating"), { status: 202 });
      }),
    );

    const asset = await generateImage({
      entityType: "character",
      entityId: "codex-szelene",
      projectId: FAROSZ_PROJECT.id,
      style: "realistic_portrait",
    });

    expect(seenUrl).toContain(AI_BASE_URL);
    expect(seenUrl).toContain("/ai/images");
    expect(seenBody).toMatchObject({
      entity_type: "character",
      entity_id: "codex-szelene",
      project_id: FAROSZ_PROJECT.id,
      style: "realistic_portrait",
    });
    expect(asset.status).toBe("generating");
  });

  it("listImages builds ?entity_type=&entity_id= and parses the list", async () => {
    let seenUrl: string | null = null;
    server.use(
      http.get(`${aiBase}/ai/images`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json([makeMediaAsset("ready")]);
      }),
    );

    const images = await listImages({
      entityType: "character",
      entityId: "codex-szelene",
    });
    expect(seenUrl).toContain("entity_type=character");
    expect(seenUrl).toContain("entity_id=codex-szelene");
    expect(images).toHaveLength(1);
    expect(images[0]?.status).toBe("ready");
  });

  it("setCanonical hits POST /ai/images/{id}/canonical and parses", async () => {
    let seenUrl: string | null = null;
    let method: string | null = null;
    server.use(
      http.post(`${aiBase}/ai/images/:assetId/canonical`, ({ request }) => {
        seenUrl = request.url;
        method = request.method;
        return HttpResponse.json(makeMediaAsset("ready", { is_canonical: true }));
      }),
    );

    const asset = await setCanonical("media-7");
    expect(method).toBe("POST");
    expect(seenUrl).toContain("/ai/images/media-7/canonical");
    expect(asset.is_canonical).toBe(true);
  });

  it("deleteImage issues a DELETE against /ai/images/{id}", async () => {
    let seenUrl: string | null = null;
    let method: string | null = null;
    server.use(
      http.delete(`${aiBase}/ai/images/:assetId`, ({ request }) => {
        seenUrl = request.url;
        method = request.method;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await deleteImage("media-9");
    expect(method).toBe("DELETE");
    expect(seenUrl).toBe(`${aiBase}/ai/images/media-9`);
  });

  it("listImageStyles parses the style preset list", async () => {
    const styles = await listImageStyles("character");
    expect(styles.length).toBeGreaterThan(0);
    expect(styles.every((s) => s.entity_type === "character")).toBe(true);
    expect(styles.some((s) => s.slug === "realistic_portrait")).toBe(true);
  });

  it("listImages throws on a contract drift (missing required field)", async () => {
    server.use(
      http.get(`${aiBase}/ai/images`, () =>
        HttpResponse.json([{ id: "x" /* missing status/mime/... */ }]),
      ),
    );
    await expect(
      listImages({ entityType: "character", entityId: "codex-szelene" }),
    ).rejects.toThrow();
  });

  describe("fetchMediaBlob", () => {
    afterEach(() => window.localStorage.removeItem(TOKEN_STORAGE_KEY));

    it("sends the JWT in the Authorization HEADER (never in the URL) and returns a Blob", async () => {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, "img-token-abc");
      let seenAuth: string | null = null;
      let seenUrl = "";
      server.use(
        http.get(`${aiBase}/ai/media/:assetId`, ({ request }) => {
          seenAuth = request.headers.get("Authorization");
          seenUrl = request.url;
          return new HttpResponse(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { "Content-Type": "image/png" },
          });
        }),
      );

      const blob = await fetchMediaBlob("media-42");
      // Duck-typed on purpose: on newer Node runtimes (the CI runner was force-
      // upgraded to Node 24) fetch returns a Blob from a different realm, so
      // `instanceof Blob` is environment-dependent and broke CI.
      expect(Object.prototype.toString.call(blob)).toBe("[object Blob]");
      expect(blob.size).toBe(3);
      expect(blob.type).toBe("image/png");
      expect(seenAuth).toBe("Bearer img-token-abc");
      // The token must NOT leak into the URL (the whole point of this change).
      expect(seenUrl).toContain("/ai/media/media-42");
      expect(seenUrl).not.toContain("token=");
    });

    it("requests the thumbnail with ?thumb=1", async () => {
      let seenUrl = "";
      server.use(
        http.get(`${aiBase}/ai/media/:assetId`, ({ request }) => {
          seenUrl = request.url;
          return new HttpResponse(new Uint8Array([1]), {
            status: 200,
            headers: { "Content-Type": "image/png" },
          });
        }),
      );
      await fetchMediaBlob("media-42", { thumb: true });
      expect(seenUrl).toContain("thumb=1");
    });

    it("throws an ApiError on a non-OK status (never swallowed)", async () => {
      server.use(
        http.get(`${aiBase}/ai/media/:assetId`, () =>
          HttpResponse.json({ detail: "nope" }, { status: 401 }),
        ),
      );
      await expect(fetchMediaBlob("media-42")).rejects.toMatchObject({
        status: 401,
      });
    });
  });
});
