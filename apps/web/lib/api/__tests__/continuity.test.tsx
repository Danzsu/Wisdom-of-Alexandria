import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import { checkContinuity } from "@/lib/api/ai";
import { useCheckContinuity } from "@/lib/api/ai-hooks";
import { SCENE_ACTIVE } from "@/test/msw/fixtures";
import { Providers, createTestQueryClient } from "@/test/test-utils";

const aiBase = `${AI_BASE_URL}/api/v1`;

function wrapper() {
  const client = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Providers client={client}>{children}</Providers>;
  };
}

describe("checkContinuity (API client)", () => {
  it("POSTs scene_id + model to /ai/continuity and parses the result", async () => {
    let captured: unknown;
    server.use(
      http.post(`${aiBase}/ai/continuity`, async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({
          warnings: [
            { severity: "error", message: "X.", entity: "Szelene" },
            { severity: "warning", message: "Y.", entity: null },
          ],
          context_entities: [],
        });
      }),
    );

    const result = await checkContinuity(SCENE_ACTIVE.id, "ollama/llama3.2");
    expect(captured).toEqual({
      scene_id: SCENE_ACTIVE.id,
      model: "ollama/llama3.2",
    });
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0].entity).toBe("Szelene");
    expect(result.warnings[1].entity).toBeNull();
  });

  it("sends model: null when no model is provided", async () => {
    let captured: { model?: unknown } = {};
    server.use(
      http.post(`${aiBase}/ai/continuity`, async ({ request }) => {
        captured = (await request.json()) as { model?: unknown };
        return HttpResponse.json({ warnings: [], context_entities: [] });
      }),
    );
    await checkContinuity(SCENE_ACTIVE.id);
    expect(captured.model).toBeNull();
  });

  it("defaults entity to null when the field is omitted (tolerant schema)", async () => {
    server.use(
      http.post(`${aiBase}/ai/continuity`, () =>
        HttpResponse.json({
          warnings: [{ severity: "info", message: "Nincs entitás mező." }],
          context_entities: [],
        }),
      ),
    );
    const result = await checkContinuity(SCENE_ACTIVE.id);
    expect(result.warnings[0].entity).toBeNull();
  });

  it("parses an unknown severity (does not throw)", async () => {
    server.use(
      http.post(`${aiBase}/ai/continuity`, () =>
        HttpResponse.json({
          warnings: [{ severity: "weird", message: "M.", entity: null }],
          context_entities: [],
        }),
      ),
    );
    const result = await checkContinuity(SCENE_ACTIVE.id);
    expect(result.warnings[0].severity).toBe("weird");
  });

  it("throws on a malformed (non-array warnings) response", async () => {
    server.use(
      http.post(`${aiBase}/ai/continuity`, () =>
        // `warnings` as a string is a contract violation → Zod throws.
        HttpResponse.json({ warnings: "oops", context_entities: [] }),
      ),
    );
    await expect(checkContinuity(SCENE_ACTIVE.id)).rejects.toThrow();
  });
});

describe("useCheckContinuity (mutation hook)", () => {
  it("resolves to the parsed continuity result", async () => {
    const { result } = renderHook(() => useCheckContinuity(), {
      wrapper: wrapper(),
    });
    result.current.mutate({ sceneId: SCENE_ACTIVE.id, model: "ollama/llama3.2" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Default MSW fixture returns two mixed-severity warnings.
    expect(result.current.data?.warnings.length).toBe(2);
  });

  it("surfaces an error (not swallowed)", async () => {
    server.use(
      http.post(`${aiBase}/ai/continuity`, () =>
        HttpResponse.json({ detail: "model down" }, { status: 502 }),
      ),
    );
    const { result } = renderHook(() => useCheckContinuity(), {
      wrapper: wrapper(),
    });
    result.current.mutate({ sceneId: SCENE_ACTIVE.id });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain("model down");
  });
});
