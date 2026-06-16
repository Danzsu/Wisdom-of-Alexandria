/**
 * Client tests for the CodexRelation API module (UX-3a). Exercises the real
 * Zod-validated fetch path against the MSW relation store: list / create /
 * update / delete, plus the drift guard (a malformed response throws rather than
 * flowing a wrong shape into the graph).
 */
import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { FAROSZ_PROJECT } from "@/test/msw/fixtures";
import {
  listCodexRelations,
  createCodexRelation,
  updateCodexRelation,
  deleteCodexRelation,
} from "@/lib/api/codex-relations";

const base = `${API_BASE_URL}/api/v1`;

describe("codex-relations client", () => {
  it("lists a project's relations (Zod-validated)", async () => {
    const relations = await listCodexRelations(FAROSZ_PROJECT.id);
    expect(relations.length).toBe(2);
    expect(relations[0]).toMatchObject({
      from_entity_id: "codex-szelene",
      to_entity_id: "codex-nagykonyvtar",
      relation_type: "őrzője",
    });
  });

  it("creates a relation and echoes the created edge", async () => {
    const created = await createCodexRelation(FAROSZ_PROJECT.id, {
      from_entity_type: "character",
      from_entity_id: "codex-szelene",
      to_entity_type: "location",
      to_entity_id: "codex-nagykonyvtar",
      relation_type: "látogatja",
      description: null,
    });
    expect(created.id).toMatch(/^rel-new-/);
    expect(created.relation_type).toBe("látogatja");
    // The new edge is now in the store.
    const after = await listCodexRelations(FAROSZ_PROJECT.id);
    expect(after.length).toBe(3);
  });

  it("patches a relation's label", async () => {
    const updated = await updateCodexRelation(
      FAROSZ_PROJECT.id,
      "rel-szelene-konyvtar",
      { relation_type: "védelmezője" },
    );
    expect(updated.relation_type).toBe("védelmezője");
  });

  it("deletes a relation", async () => {
    await deleteCodexRelation(FAROSZ_PROJECT.id, "rel-szelene-konyvtar");
    const after = await listCodexRelations(FAROSZ_PROJECT.id);
    expect(after.some((r) => r.id === "rel-szelene-konyvtar")).toBe(false);
  });

  it("throws on a malformed response (drift guard, never swallowed)", async () => {
    server.use(
      http.get(`${base}/projects/:projectId/codex-relations`, () =>
        // Missing required fields — Zod must reject this.
        HttpResponse.json([{ id: "x" }]),
      ),
    );
    await expect(listCodexRelations(FAROSZ_PROJECT.id)).rejects.toThrow();
  });

  it("surfaces a non-2xx as a thrown ApiError", async () => {
    server.use(
      http.delete(`${base}/projects/:projectId/codex-relations/:id`, () =>
        HttpResponse.json({ detail: "Relation not found" }, { status: 404 }),
      ),
    );
    await expect(
      deleteCodexRelation(FAROSZ_PROJECT.id, "nope"),
    ).rejects.toThrow();
  });
});
