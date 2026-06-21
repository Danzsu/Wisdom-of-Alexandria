import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL, ApiError } from "@/lib/api/client";
import {
  approveRevision,
  createSnippet,
  describe as describeApi,
  generateScene,
  indexProjectAsync,
  listModels,
  research,
  resolveProjectIdForBook,
  rewrite,
} from "@/lib/api/ai";
import {
  FAROSZ_BOOK,
  FAROSZ_PROJECT,
  makeIndexJob,
  makeResearchResult,
} from "@/test/msw/fixtures";

/** AI service base — `/ai/*` handlers live here after the Alexandria split. */
const aiBase = `${AI_BASE_URL}/api/v1`;

describe("lib/api/ai", () => {
  afterEach(() => server.resetHandlers());

  it("AI calls target the AI service base URL (NEXT_PUBLIC_AI_URL), not the domain base", async () => {
    // The default AI base is :8001; the domain base is :8000. Assert the actual
    // request URL the client builds for an `/ai/*` call resolves to the AI base
    // (this is what makes the Alexandria split routing correct).
    // Absent an override, the AI base MUST resolve to the :8001 default (not the
    // domain :8000, and not some other host that would silently break every call).
    expect(AI_BASE_URL).not.toBe("http://localhost:8000");
    expect(AI_BASE_URL).toMatch(/:8001(\/|$)/);
    let seenUrl: string | null = null;
    server.use(
      http.post(`${aiBase}/ai/rewrite`, ({ request }) => {
        seenUrl = request.url;
        return HttpResponse.json({ detail: "stub" }, { status: 502 });
      }),
    );
    // The call rejects (502) but the handler still captured the URL it hit. If
    // the call had gone to the domain base, this handler would not match and
    // MSW's `onUnhandledRequest: "error"` would fail the test instead.
    await rewrite({ selected_text: "x", instruction: "y" }).catch(() => {});
    expect(seenUrl).toBe(`${aiBase}/ai/rewrite`);
    expect(seenUrl).toContain(AI_BASE_URL);
  });

  it("listModels returns the config-driven model list", async () => {
    const res = await listModels();
    expect(res.default).toBe("ollama/llama3.2");
    expect(res.models[0]?.id).toBe("ollama/llama3.2");
    expect(res.models[0]?.kind).toBe("local");
  });

  it("rewrite returns an UNAPPROVED revision (human-in-the-loop)", async () => {
    const res = await rewrite({
      selected_text: "x",
      instruction: "y",
      model: "ollama/llama3.2",
    });
    expect(res.revision.approved).toBe(false);
    expect(res.revision.content.length).toBeGreaterThan(0);
    expect(res.revision.model_name).toBe("ollama/llama3.2");
  });

  it("generateScene returns a revision", async () => {
    const res = await generateScene({ beats: ["beat"], model: "ollama/llama3.2" });
    expect(res.revision.revision_type).toBe("generate_scene");
  });

  it("rewrite parses the retrieved context_entities ({id,label,entity_type})", async () => {
    const res = await rewrite({ selected_text: "x", instruction: "y" });
    // The default fixture grounds on a character + a location.
    expect(res.context_entities.length).toBeGreaterThan(0);
    const character = res.context_entities.find(
      (e) => e.entity_type === "character",
    );
    expect(character?.label).toBe("Szelene");
    expect(typeof character?.id).toBe("string");
  });

  it("coerces a response WITHOUT context_entities to [] (.default — older AI service / RAG skipped)", async () => {
    // A response that omits the field entirely must still parse: the field is
    // `.default([])`, so a missing list degrades to no context — never a throw.
    server.use(
      http.post(`${aiBase}/ai/rewrite`, () =>
        HttpResponse.json({
          revision: {
            id: "rev-nocx",
            scene_id: null,
            job_id: null,
            content: "szöveg",
            approved: false,
            revision_type: "rewrite",
            model_name: "ollama/llama3.2",
            prompt_version: "1.0",
            created_at: "2026-06-14T16:00:00Z",
            updated_at: "2026-06-14T16:00:00Z",
          },
          job: {
            id: "job-nocx",
            project_id: null,
            scene_id: null,
            chapter_id: null,
            job_type: "rewrite",
            status: "done",
            model_name: "ollama/llama3.2",
            prompt_version: "1.0",
            input_data: {},
            output_data: {},
            error_message: null,
            created_at: "2026-06-14T16:00:00Z",
            updated_at: "2026-06-14T16:00:00Z",
          },
          // context_entities intentionally omitted.
        }),
      ),
    );
    const res = await rewrite({ selected_text: "x", instruction: "y" });
    expect(res.context_entities).toEqual([]);
  });

  it("parses an UNKNOWN entity_type without throwing (graceful FE fallback)", async () => {
    // entity_type is a plain string on the wire; an unrecognised value parses
    // (the UI maps it to a fallback icon) rather than failing the whole result.
    server.use(
      http.post(`${aiBase}/ai/rewrite`, () =>
        HttpResponse.json({
          revision: {
            id: "rev-unk",
            scene_id: null,
            job_id: null,
            content: "szöveg",
            approved: false,
            revision_type: "rewrite",
            model_name: "ollama/llama3.2",
            prompt_version: "1.0",
            created_at: "2026-06-14T16:00:00Z",
            updated_at: "2026-06-14T16:00:00Z",
          },
          job: {
            id: "job-unk",
            project_id: null,
            scene_id: null,
            chapter_id: null,
            job_type: "rewrite",
            status: "done",
            model_name: "ollama/llama3.2",
            prompt_version: "1.0",
            input_data: {},
            output_data: {},
            error_message: null,
            created_at: "2026-06-14T16:00:00Z",
            updated_at: "2026-06-14T16:00:00Z",
          },
          context_entities: [
            { id: "x-1", label: "Valami", entity_type: "totally_unknown" },
          ],
        }),
      ),
    );
    const res = await rewrite({ selected_text: "x", instruction: "y" });
    expect(res.context_entities[0]?.entity_type).toBe("totally_unknown");
  });

  it("describe returns one revision per requested channel", async () => {
    const res = await describeApi({
      selected_text: "x",
      channels: ["Látás", "Hang"],
    });
    expect(res.revisions).toHaveLength(2);
  });

  it("approveRevision marks the revision approved", async () => {
    const res = await approveRevision("rev-1");
    expect(res.approved).toBe(true);
    expect(res.id).toBe("rev-1");
  });

  it("createSnippet POSTs to the project-scoped endpoint", async () => {
    const res = await createSnippet(FAROSZ_PROJECT.id, {
      title: "t",
      content: "c",
      tags: [],
    });
    expect(res.project_id).toBe(FAROSZ_PROJECT.id);
    expect(res.title).toBe("t");
  });

  it("resolveProjectIdForBook finds the owning project", async () => {
    const projectId = await resolveProjectIdForBook(FAROSZ_BOOK.id);
    expect(projectId).toBe(FAROSZ_PROJECT.id);
  });

  it("resolveProjectIdForBook throws when no project owns the book", async () => {
    await expect(resolveProjectIdForBook("unknown-book")).rejects.toThrow();
  });

  it("research POSTs question + project_id to the AI base and parses the answer + chips", async () => {
    let seenUrl: string | null = null;
    let seenBody: unknown = null;
    server.use(
      http.post(`${aiBase}/ai/research`, async ({ request }) => {
        seenUrl = request.url;
        seenBody = await request.json();
        return HttpResponse.json(makeResearchResult("A válasz."));
      }),
    );
    const res = await research({
      question: "Ki Szelene?",
      projectId: FAROSZ_PROJECT.id,
    });
    expect(seenUrl).toContain(AI_BASE_URL);
    expect(seenBody).toMatchObject({
      question: "Ki Szelene?",
      project_id: FAROSZ_PROJECT.id,
    });
    expect(res.answer).toBe("A válasz.");
    expect(res.context_entities.length).toBeGreaterThan(0);
  });

  it("indexProjectAsync POSTs to the AI base with project_id and parses the job", async () => {
    let seenUrl: string | null = null;
    let seenMethod: string | null = null;
    server.use(
      http.post(`${aiBase}/ai/index/async`, ({ request }) => {
        seenUrl = request.url;
        seenMethod = request.method;
        return HttpResponse.json(makeIndexJob("pending"), { status: 202 });
      }),
    );
    const job = await indexProjectAsync(FAROSZ_PROJECT.id);
    expect(seenMethod).toBe("POST");
    expect(seenUrl).toContain(AI_BASE_URL);
    expect(seenUrl).toContain(`project_id=${FAROSZ_PROJECT.id}`);
    // Drift-validated parse: job_type + status come back as the queued index job.
    expect(job.job_type).toBe("index");
    expect(job.status).toBe("pending");
  });

  it("propagates AI errors (never swallowed)", async () => {
    server.use(
      http.post(`${aiBase}/ai/rewrite`, () =>
        HttpResponse.json({ detail: "AI error: boom" }, { status: 502 }),
      ),
    );
    await expect(
      rewrite({ selected_text: "x", instruction: "y" }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
