import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import {
  AI_BASE_URL,
  ApiError,
  API_BASE_URL,
  TOKEN_STORAGE_KEY,
  apiFetch,
  getAuthToken,
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

describe("apiFetch — transport errors (T5)", () => {
  it("surfaces a localized message (not the raw browser string) on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );
    await expect(apiFetch("/projects")).rejects.toMatchObject({
      status: 0,
      message: "Nem sikerült elérni a szervert. Ellenőrizd a kapcsolatot.",
    });
  });

  it("re-throws an AbortError without converting it to an ApiError", async () => {
    const abortError = new DOMException("The user aborted a request.", "AbortError");
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(abortError);
    let thrown: unknown;
    try {
      await apiFetch("/projects");
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(DOMException);
    expect(thrown).not.toBeInstanceOf(ApiError);
  });
});

describe("getAuthToken — localStorage fallback (A10.2)", () => {
  it("warns (without logging the token) and falls back when localStorage throws", () => {
    // Force a localStorage failure (private mode / disabled storage). Spying on
    // the instance's getItem does NOT intercept under this jsdom setup (getItem
    // lives on Storage.prototype), so replace the whole `localStorage` accessor
    // on `window` with one whose getItem throws, then restore it.
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => ({
        getItem() {
          throw new Error("storage disabled");
        },
      }),
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      // Behaviour is preserved: the env dev-token fallback is still returned.
      const token = getAuthToken();

      expect(warnSpy).toHaveBeenCalledWith(
        "localStorage unavailable; falling back to NEXT_PUBLIC_DEV_TOKEN",
      );
      // The warning must NEVER carry the token value — only the fixed message.
      for (const call of warnSpy.mock.calls) {
        for (const arg of call) {
          if (typeof arg === "string" && token) {
            expect(arg).not.toContain(token);
          }
        }
      }
    } finally {
      warnSpy.mockRestore();
      if (original) Object.defineProperty(window, "localStorage", original);
    }
  });
});
