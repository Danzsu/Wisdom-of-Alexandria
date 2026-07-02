/**
 * Contract tests for the three new AI writing operations (expand / compress /
 * brainstorm) + the prompt-template `uses` counter client.
 *
 * Mutation-proof focus: the EXACT request payloads (selected_text / guidance /
 * scene_id; topic / count), the service base each call targets (AI :8001 vs
 * domain :8000), the HITL invariant (unapproved revision, no approve side
 * effect), tolerant parsing, and error propagation.
 */
import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL, API_BASE_URL, ApiError } from "@/lib/api/client";
import { brainstorm, compress, expand } from "@/lib/api/ai";
import { registerPromptTemplateUse } from "@/lib/api/prompts";
import { resetPromptTemplateStore } from "@/test/msw/handlers";
import {
  AI_GENERATED_TEXT,
  BRAINSTORM_IDEAS_FIXTURE,
  SCENE_ACTIVE,
  makeAiResult,
  makeBrainstormResult,
} from "@/test/msw/fixtures";

/** AI service base — `/ai/*` handlers live here after the Alexandria split. */
const aiBase = `${AI_BASE_URL}/api/v1`;
/** Domain base — `/prompt-templates/*` stays on the domain backend (:8000). */
const base = `${API_BASE_URL}/api/v1`;

describe("lib/api/ai — expand", () => {
  afterEach(() => server.resetHandlers());

  it("POSTs the exact {selected_text, guidance, scene_id} body to the AI base", async () => {
    let seenUrl: string | null = null;
    let seenBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${aiBase}/ai/expand`, async ({ request }) => {
        seenUrl = request.url;
        seenBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          makeAiResult("expand", AI_GENERATED_TEXT, "ollama/llama3.2"),
        );
      }),
    );
    await expand({
      selected_text: "A lány nem fordult meg.",
      guidance: "több érzéki részlet",
      scene_id: SCENE_ACTIVE.id,
    });
    expect(seenUrl).toBe(`${aiBase}/ai/expand`);
    expect(seenUrl).toContain(AI_BASE_URL);
    expect(seenBody).toMatchObject({
      selected_text: "A lány nem fordult meg.",
      guidance: "több érzéki részlet",
      scene_id: SCENE_ACTIVE.id,
    });
  });

  it("returns an UNAPPROVED revision with revision_type 'expand' (HITL)", async () => {
    const res = await expand({ selected_text: "x" });
    expect(res.revision.approved).toBe(false);
    expect(res.revision.revision_type).toBe("expand");
    expect(res.revision.content.length).toBeGreaterThan(0);
  });

  it("never fires an approve as a side effect of expanding (HITL invariant)", async () => {
    let approveCalled = false;
    server.use(
      http.post(`${API_BASE_URL}/api/v1/revisions/:id/approve`, () => {
        approveCalled = true;
        return HttpResponse.json({ detail: "must-not-happen" }, { status: 500 });
      }),
    );
    await expand({ selected_text: "x" });
    expect(approveCalled).toBe(false);
  });

  it("propagates an expand error (never swallowed)", async () => {
    server.use(
      http.post(`${aiBase}/ai/expand`, () =>
        HttpResponse.json({ detail: "AI error: boom" }, { status: 502 }),
      ),
    );
    await expect(expand({ selected_text: "x" })).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe("lib/api/ai — compress", () => {
  afterEach(() => server.resetHandlers());

  it("POSTs the exact {selected_text, scene_id} body to the AI base", async () => {
    let seenUrl: string | null = null;
    let seenBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${aiBase}/ai/compress`, async ({ request }) => {
        seenUrl = request.url;
        seenBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          makeAiResult("compress", AI_GENERATED_TEXT, "ollama/llama3.2"),
        );
      }),
    );
    await compress({
      selected_text: "Hosszú, terjengős bekezdés.",
      scene_id: SCENE_ACTIVE.id,
    });
    expect(seenUrl).toBe(`${aiBase}/ai/compress`);
    expect(seenBody).toMatchObject({
      selected_text: "Hosszú, terjengős bekezdés.",
      scene_id: SCENE_ACTIVE.id,
    });
  });

  it("returns an UNAPPROVED revision with revision_type 'compress' (HITL)", async () => {
    const res = await compress({ selected_text: "x" });
    expect(res.revision.approved).toBe(false);
    expect(res.revision.revision_type).toBe("compress");
  });

  it("propagates a compress error (never swallowed)", async () => {
    server.use(
      http.post(`${aiBase}/ai/compress`, () =>
        HttpResponse.json({ detail: "AI error: boom" }, { status: 502 }),
      ),
    );
    await expect(compress({ selected_text: "x" })).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});

describe("lib/api/ai — brainstorm", () => {
  afterEach(() => server.resetHandlers());

  it("POSTs the exact {topic, count, scene_id} body to the AI base", async () => {
    let seenUrl: string | null = null;
    let seenBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${aiBase}/ai/brainstorm`, async ({ request }) => {
        seenUrl = request.url;
        seenBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeBrainstormResult());
      }),
    );
    await brainstorm({
      topic: "Mi legyen a következő fordulat?",
      count: 3,
      scene_id: SCENE_ACTIVE.id,
    });
    expect(seenUrl).toBe(`${aiBase}/ai/brainstorm`);
    expect(seenUrl).toContain(AI_BASE_URL);
    expect(seenBody).toMatchObject({
      topic: "Mi legyen a következő fordulat?",
      count: 3,
      scene_id: SCENE_ACTIVE.id,
    });
  });

  it("returns the idea TEXTS (no revision — ideas are not manuscript text)", async () => {
    const res = await brainstorm({ topic: "fordulatok", count: 5 });
    expect(res.ideas).toEqual(BRAINSTORM_IDEAS_FIXTURE);
    // The result shape has NO revision key at all — nothing insertable.
    expect("revision" in res).toBe(false);
    // Provenance: the brainstorm GenerationJob is attached.
    expect(res.job?.job_type).toBe("brainstorm");
  });

  it("honors the requested count (the default handler slices)", async () => {
    const res = await brainstorm({ topic: "fordulatok", count: 2 });
    expect(res.ideas).toHaveLength(2);
  });

  it("parses a lean response: missing ideas → [], null job (whitespace-topic short-circuit)", async () => {
    server.use(
      http.post(`${aiBase}/ai/brainstorm`, () =>
        HttpResponse.json({ job: null, context_entities: [] }),
      ),
    );
    const res = await brainstorm({ topic: "x" });
    expect(res.ideas).toEqual([]);
    expect(res.job).toBeNull();
  });

  it("parses the RAG context chips ({id,label,entity_type})", async () => {
    const res = await brainstorm({ topic: "fordulatok" });
    const character = res.context_entities.find(
      (e) => e.entity_type === "character",
    );
    expect(character?.label).toBe("Szelene");
  });

  it("propagates a brainstorm error (never swallowed)", async () => {
    server.use(
      http.post(`${aiBase}/ai/brainstorm`, () =>
        HttpResponse.json({ detail: "AI error: boom" }, { status: 502 }),
      ),
    );
    await expect(brainstorm({ topic: "x" })).rejects.toBeInstanceOf(ApiError);
  });
});

describe("lib/api/prompts — registerPromptTemplateUse", () => {
  afterEach(() => {
    server.resetHandlers();
    resetPromptTemplateStore();
  });

  it("POSTs to the DOMAIN base /prompt-templates/{id}/use and parses {uses}", async () => {
    let seenUrl: string | null = null;
    let seenMethod: string | null = null;
    server.use(
      http.post(`${base}/prompt-templates/:id/use`, ({ request }) => {
        seenUrl = request.url;
        seenMethod = request.method;
        return HttpResponse.json({ uses: 7 });
      }),
    );
    const res = await registerPromptTemplateUse("builtin-1");
    expect(seenMethod).toBe("POST");
    expect(seenUrl).toBe(`${base}/prompt-templates/builtin-1/use`);
    expect(seenUrl).toContain(API_BASE_URL);
    expect(res.uses).toBe(7);
  });

  it("increments statefully: two uses on the same template → 1 then 2", async () => {
    const first = await registerPromptTemplateUse("builtin-1");
    const second = await registerPromptTemplateUse("builtin-1");
    expect(first.uses).toBe(1);
    expect(second.uses).toBe(2);
  });

  it("rejects with ApiError for an unknown template id (404)", async () => {
    await expect(
      registerPromptTemplateUse("no-such-template"),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects on a malformed body (Zod gate — contract drift throws)", async () => {
    server.use(
      http.post(`${base}/prompt-templates/:id/use`, () =>
        HttpResponse.json({ uses: "hét" }),
      ),
    );
    await expect(registerPromptTemplateUse("builtin-1")).rejects.toThrow();
  });
});
