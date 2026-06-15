import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL, ApiError } from "@/lib/api/client";
import {
  approveRevision,
  createSnippet,
  describe as describeApi,
  generateScene,
  listModels,
  resolveProjectIdForBook,
  rewrite,
} from "@/lib/api/ai";
import { FAROSZ_BOOK, FAROSZ_PROJECT } from "@/test/msw/fixtures";

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
