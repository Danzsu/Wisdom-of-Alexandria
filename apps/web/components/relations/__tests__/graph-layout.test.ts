/**
 * Unit tests for the headless, deterministic graph layout (UX-3a). The
 * simulation runs synchronously (no rAF) so it must produce finite, in-bounds,
 * reproducible coordinates under jsdom.
 */
import { describe, expect, it } from "vitest";
import { layoutGraph } from "../graph-layout";
import { buildGraphData } from "../graph-data";
import type { CodexEntryRead, CodexRelationRead } from "@/lib/api/types";

function entry(id: string): CodexEntryRead {
  return {
    id,
    project_id: "p1",
    series_id: null,
    title: id.toUpperCase(),
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

function relation(id: string, from: string, to: string): CodexRelationRead {
  return {
    id,
    project_id: "p1",
    from_entity_type: "character",
    from_entity_id: from,
    to_entity_type: "character",
    to_entity_id: to,
    relation_type: "kapcsolat",
    description: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

const GRAPH = buildGraphData(
  [relation("r1", "a", "b"), relation("r2", "b", "c")],
  [entry("a"), entry("b"), entry("c")],
);

describe("layoutGraph", () => {
  it("produces finite, in-bounds positions for every node", () => {
    const { nodes, width, height } = layoutGraph(GRAPH, {
      width: 400,
      height: 300,
    });
    expect(nodes).toHaveLength(3);
    for (const node of nodes) {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(width);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(height);
    }
  });

  it("resolves both endpoints of each edge to positions", () => {
    const { edges } = layoutGraph(GRAPH);
    expect(edges).toHaveLength(2);
    for (const edge of edges) {
      expect(Number.isFinite(edge.x1)).toBe(true);
      expect(Number.isFinite(edge.y2)).toBe(true);
    }
  });

  it("is deterministic — same input yields identical coordinates", () => {
    const a = layoutGraph(GRAPH);
    const b = layoutGraph(GRAPH);
    expect(a.nodes.map((n) => [n.x, n.y])).toEqual(
      b.nodes.map((n) => [n.x, n.y]),
    );
  });

  it("handles an empty graph without throwing", () => {
    const empty = buildGraphData([], []);
    const { nodes, edges } = layoutGraph(empty);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });
});
