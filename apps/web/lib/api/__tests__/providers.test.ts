import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL, ApiError } from "@/lib/api/client";
import {
  asProviderType,
  createProvider,
  deleteProvider,
  listProviderModels,
  listProviders,
  providerReadSchema,
  providerTypeNeedsKey,
  testProvider,
  updateProvider,
} from "@/lib/api/providers";
import { resetProviderStore } from "@/test/msw/handlers";
import { PROVIDER_GEMINI, PROVIDER_OLLAMA } from "@/test/msw/fixtures";

// Providers moved to the AI service (Alexandria split); overrides target it.
const base = `${AI_BASE_URL}/api/v1`;

describe("lib/api/providers", () => {
  beforeEach(() => resetProviderStore());
  afterEach(() => server.resetHandlers());

  it("listProviders returns masked reads (never a raw key)", async () => {
    const providers = await listProviders();
    const gemini = providers.find((p) => p.id === PROVIDER_GEMINI.id);
    expect(gemini?.api_key_masked).toBe("••••3f8a");
    expect(gemini?.has_key).toBe(true);
    // The read schema has no `api_key` field at all — a raw key cannot slip in.
    expect(Object.keys(providerReadSchema.shape)).not.toContain("api_key");
  });

  it("listProviders honours ?enabled_only", async () => {
    // Disable ollama via the store-backed PATCH (it persists), then the
    // enabled-only list must exclude it.
    await updateProvider(PROVIDER_OLLAMA.id, { enabled: false });
    const enabled = await listProviders(true);
    expect(enabled.every((p) => p.enabled)).toBe(true);
    expect(enabled.find((p) => p.id === PROVIDER_OLLAMA.id)).toBeUndefined();
  });

  it("createProvider sends the plaintext api_key and gets a masked read back", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${base}/providers`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            ...PROVIDER_GEMINI,
            id: "prov-x",
            api_key_masked: "••••1234",
            has_key: true,
          },
          { status: 201 },
        );
      }),
    );
    const created = await createProvider({
      type: "anthropic",
      label: "Claude",
      api_key: "sk-ant-1234",
    });
    expect(body).toMatchObject({ api_key: "sk-ant-1234" });
    expect(created.api_key_masked).toBe("••••1234");
  });

  it("updateProvider OMITS api_key when the patch has none (keep-key contract)", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${base}/providers/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(PROVIDER_GEMINI);
      }),
    );
    await updateProvider(PROVIDER_GEMINI.id, { label: "Renamed" });
    expect(body).toMatchObject({ label: "Renamed" });
    expect(body).not.toHaveProperty("api_key");
  });

  it("updateProvider includes api_key only when supplied", async () => {
    let body: Record<string, unknown> | null = null;
    server.use(
      http.patch(`${base}/providers/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(PROVIDER_GEMINI);
      }),
    );
    await updateProvider(PROVIDER_GEMINI.id, { api_key: "sk-new" });
    expect(body).toMatchObject({ api_key: "sk-new" });
  });

  it("testProvider returns the ok/detail contract", async () => {
    const res = await testProvider(PROVIDER_GEMINI.id);
    expect(res.ok).toBe(true);
    expect(typeof res.detail).toBe("string");
  });

  it("listProviderModels returns the provider model list", async () => {
    const res = await listProviderModels(PROVIDER_GEMINI.id);
    expect(res.models.length).toBeGreaterThan(0);
    expect(res.models[0]).toHaveProperty("id");
    expect(res.models[0]).toHaveProperty("label");
  });

  it("deleteProvider resolves on 204", async () => {
    await expect(deleteProvider(PROVIDER_GEMINI.id)).resolves.toBeUndefined();
  });

  it("throws a typed ApiError on a non-OK response (no swallow)", async () => {
    server.use(
      http.get(`${base}/providers`, () =>
        HttpResponse.json({ detail: "nope" }, { status: 500 }),
      ),
    );
    await expect(listProviders()).rejects.toBeInstanceOf(ApiError);
  });

  it("throws when the response shape drifts from the schema", async () => {
    server.use(
      http.get(`${base}/providers`, () =>
        HttpResponse.json([{ id: "x" /* missing required fields */ }]),
      ),
    );
    await expect(listProviders()).rejects.toThrow();
  });

  it("type helpers: ollama is keyless, cloud types need a key", () => {
    expect(providerTypeNeedsKey("ollama")).toBe(false);
    expect(providerTypeNeedsKey("gemini")).toBe(true);
    expect(providerTypeNeedsKey("anthropic")).toBe(true);
    expect(asProviderType("openai")).toBe("openai");
    expect(asProviderType("not-a-type")).toBeNull();
  });
});
