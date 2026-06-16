/**
 * Unit tests for the pure graph-data assembly (UX-3a). No React / d3 / DOM —
 * just relations + entries → { nodes, edges }, including the graceful
 * missing-entity fallback.
 */
import { describe, expect, it } from "vitest";
import {
  buildGraphData,
  relationsForNode,
  MISSING_NODE_LABEL,
} from "../graph-data";
import type { CodexEntryRead, CodexRelationRead } from "@/lib/api/types";

function entry(id: string, title: string): CodexEntryRead {
  return {
    id,
    project_id: "p1",
    series_id: null,
    title,
    entry_type: "character",
    content: null,
    aliases: [],
    role: null,
    ai_visible: true,
    tags: [],
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function relation(
  id: string,
  fromId: string,
  toId: string,
  label: string,
): CodexRelationRead {
  return {
    id,
    project_id: "p1",
    from_entity_type: "character",
    from_entity_id: fromId,
    to_entity_type: "character",
    to_entity_id: toId,
    relation_type: label,
    description: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

describe("buildGraphData", () => {
  it("turns relations into edges and their endpoints into nodes", () => {
    const entries = [entry("a", "Anna"), entry("b", "Béla"), entry("c", "Cili")];
    const relations = [relation("r1", "a", "b", "barátja")];

    const graph = buildGraphData(relations, entries);

    // Only entities that appear in a relation become nodes — Cili is excluded.
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toMatchObject({
      source: "a",
      target: "b",
      label: "barátja",
    });
    // Labels resolve from the codex titles.
    expect(graph.nodes.find((n) => n.id === "a")?.label).toBe("Anna");
  });

  it("degrades a dangling reference to a muted placeholder node (no crash)", () => {
    const entries = [entry("a", "Anna")];
    const relations = [relation("r1", "a", "ghost", "mentora")];

    const graph = buildGraphData(relations, entries);

    const ghost = graph.nodes.find((n) => n.id === "ghost");
    expect(ghost).toBeDefined();
    expect(ghost?.missing).toBe(true);
    expect(ghost?.label).toBe(MISSING_NODE_LABEL);
    // The edge still exists — the graph renders rather than throwing.
    expect(graph.edges).toHaveLength(1);
  });

  it("dedupes a node that participates in multiple relations", () => {
    const entries = [entry("a", "Anna"), entry("b", "Béla"), entry("c", "Cili")];
    const relations = [
      relation("r1", "a", "b", "barátja"),
      relation("r2", "a", "c", "ellensége"),
    ];

    const graph = buildGraphData(relations, entries);
    expect(graph.nodes.filter((n) => n.id === "a")).toHaveLength(1);
    expect(graph.edges).toHaveLength(2);
  });

  it("relationsForNode returns every incident relation", () => {
    const relations = [
      relation("r1", "a", "b", "barátja"),
      relation("r2", "c", "a", "mentora"),
      relation("r3", "b", "c", "rivális"),
    ];
    const incident = relationsForNode("a", relations);
    expect(incident.map((r) => r.id).sort()).toEqual(["r1", "r2"]);
  });
});
