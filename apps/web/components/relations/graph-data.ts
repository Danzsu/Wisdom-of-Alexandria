/**
 * Pure graph-data assembly for the relationship graph (UX-3a).
 *
 * Turns the project's `CodexRelationRead[]` (edges) plus its `CodexEntryRead[]`
 * (the node corpus) into the `{ nodes, edges }` shape the SVG renders. Only the
 * entities that appear in at least one relation become nodes. A relation that
 * references an entity which no longer exists still produces a node — a muted
 * "ismeretlen" placeholder — so a dangling edge degrades gracefully instead of
 * crashing the graph.
 *
 * This module is deliberately free of React / d3 / DOM so the derivation is unit
 * testable and identical under SSR, jsdom and the browser.
 */
import type { CodexEntryRead, CodexRelationRead } from "@/lib/api/types";
import { povSlot, type PovSlot } from "@/lib/pov-color";

/** A graph node — one codex entity that participates in ≥1 relation. */
export interface GraphNode {
  /** The entity id (`from_entity_id` / `to_entity_id`). */
  id: string;
  /** Display label — the codex entry title, or the fallback when unresolved. */
  label: string;
  /** The polymorphic entity type carried on the relation endpoint. */
  entityType: string;
  /** Deterministic POV colour slot (by label) for resolved nodes. */
  pov: PovSlot;
  /** True when the referenced entity no longer exists (muted placeholder). */
  missing: boolean;
}

/** A graph edge — one directed relation between two nodes. */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  /** The free-text relation label (`relation_type`). */
  label: string;
  description: string | null;
}

/** The assembled graph: nodes that participate in ≥1 relation, plus the edges. */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Label shown for a relation endpoint whose codex entry is gone. */
export const MISSING_NODE_LABEL = "Ismeretlen";

/**
 * Assemble the graph from a project's relations + codex entries.
 *
 * `relations` drives which nodes appear (an isolated codex entry with no
 * relation is intentionally NOT a node — the graph is about connections). Each
 * endpoint id is resolved against `entries`; an unresolved id becomes a muted
 * placeholder node so a dangling reference never throws.
 */
export function buildGraphData(
  relations: readonly CodexRelationRead[],
  entries: readonly CodexEntryRead[],
): GraphData {
  const byId = new Map<string, CodexEntryRead>();
  for (const entry of entries) byId.set(entry.id, entry);

  const nodes = new Map<string, GraphNode>();

  const ensureNode = (id: string, entityType: string): void => {
    if (nodes.has(id)) return;
    const entry = byId.get(id);
    const label = entry ? entry.title : MISSING_NODE_LABEL;
    nodes.set(id, {
      id,
      label,
      entityType: entry ? entry.entry_type : entityType,
      // POV colour keys off the resolved label so a person is always the same
      // hue across avatars and the graph; missing nodes still get a stable slot.
      pov: povSlot(label || id),
      missing: !entry,
    });
  };

  const edges: GraphEdge[] = relations.map((relation) => {
    ensureNode(relation.from_entity_id, relation.from_entity_type);
    ensureNode(relation.to_entity_id, relation.to_entity_type);
    return {
      id: relation.id,
      source: relation.from_entity_id,
      target: relation.to_entity_id,
      label: relation.relation_type,
      description: relation.description,
    };
  });

  return { nodes: Array.from(nodes.values()), edges };
}

/** The relations touching a given node (either endpoint). Detail-panel input. */
export function relationsForNode(
  nodeId: string,
  relations: readonly CodexRelationRead[],
): CodexRelationRead[] {
  return relations.filter(
    (r) => r.from_entity_id === nodeId || r.to_entity_id === nodeId,
  );
}
