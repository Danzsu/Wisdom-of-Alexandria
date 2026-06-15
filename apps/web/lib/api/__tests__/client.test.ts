import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import {
  AI_BASE_URL,
  ApiError,
  API_BASE_URL,
  TOKEN_STORAGE_KEY,
  apiFetch,
} from "@/lib/api/client";

const base = `${API_BASE_URL}/api/v1`;
const aiBase = `${AI_BASE_URL}/api/v1`;

afterEach(() => {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore — storage is reset per test environment anyway
  }
});

describe("apiFetch", () => {
  it("parses a successful JSON response", async () => {
    server.use(
      http.get(`${base}/ping`, () => HttpResponse.json({ ok: true })),
    );
    const result = await apiFetch<{ ok: boolean }>("/ping");
    expect(result).toEqual({ ok: true });
  });

  it("throws a typed ApiError on a non-OK response and does NOT swallow it", async () => {
    server.use(
      http.get(`${base}/missing`, () =>
        HttpResponse.json({ detail: "Project not found" }, { status: 404 }),
      ),
    );
    await expect(apiFetch("/missing")).rejects.toBeInstanceOf(ApiError);
    await expect(apiFetch("/missing")).rejects.toMatchObject({
      status: 404,
      message: "Project not found",
    });
  });

  it("surfaces a 422 validation message from the FastAPI error body", async () => {
    server.use(
      http.post(`${base}/projects`, () =>
        HttpResponse.json(
          { detail: [{ msg: "title is required", loc: ["body", "title"] }] },
          { status: 422 },
        ),
      ),
    );
    await expect(
      apiFetch("/projects", { method: "POST", body: {} }),
    ).rejects.toMatchObject({ status: 422, message: "title is required" });
  });

  it("attaches the bearer token from localStorage", async () => {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "secret-token");
    let seenAuth: string | null = null;
    server.use(
      http.get(`${base}/whoami`, ({ request }) => {
        seenAuth = request.headers.get("Authorization");
        return HttpResponse.json({ ok: true });
      }),
    );
    await apiFetch("/whoami");
    expect(seenAuth).toBe("Bearer secret-token");
  });

  it("routes a call to the AI base when `baseUrl` is given, still attaching the JWT", async () => {
    // After the Alexandria split, AI/provider/job modules pass `AI_BASE_URL` as
    // the per-call `baseUrl` override. The request must hit the AI base (:8001),
    // NOT the domain base (:8000), and the same Bearer token must still be sent.
    window.localStorage.setItem(TOKEN_STORAGE_KEY, "ai-token");
    let seenUrl: string | null = null;
    let seenAuth: string | null = null;
    server.use(
      http.get(`${aiBase}/ai/models`, ({ request }) => {
        seenUrl = request.url;
        seenAuth = request.headers.get("Authorization");
        return HttpResponse.json({ ok: true });
      }),
    );
    await apiFetch("/ai/models", { baseUrl: AI_BASE_URL });
    expect(seenUrl).toBe(`${aiBase}/ai/models`);
    expect(seenUrl).toContain(AI_BASE_URL);
    expect(seenAuth).toBe("Bearer ai-token");
  });

  it("returns null for an empty body (204 No Content)", async () => {
    server.use(
      http.delete(`${base}/projects/x`, () => new HttpResponse(null, { status: 204 })),
    );
    const result = await apiFetch("/projects/x", { method: "DELETE" });
    expect(result).toBeNull();
  });

  it("throws an ApiError when a non-empty body is not valid JSON", async () => {
    server.use(
      http.get(`${base}/broken`, () =>
        HttpResponse.text("<html>not json</html>", { status: 200 }),
      ),
    );
    await expect(apiFetch("/broken")).rejects.toBeInstanceOf(ApiError);
  });
});
