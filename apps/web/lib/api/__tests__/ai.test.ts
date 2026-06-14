import { afterEach, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import {
  approveRevision,
  createSnippet,
  describe as describeApi,
  generateScene,
  listModels,
  resolveProjectIdForBook,
  rewrite,
} from "@/lib/api/ai";
import { ApiError } from "@/lib/api/client";
import { FAROSZ_BOOK, FAROSZ_PROJECT } from "@/test/msw/fixtures";

const base = `${API_BASE_URL}/api/v1`;

describe("lib/api/ai", () => {
  afterEach(() => server.resetHandlers());

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
      http.post(`${base}/ai/rewrite`, () =>
        HttpResponse.json({ detail: "AI error: boom" }, { status: 502 }),
      ),
    );
    await expect(
      rewrite({ selected_text: "x", instruction: "y" }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
