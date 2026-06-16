/**
 * Deterministic graph layout for the relationship graph (UX-3a).
 *
 * Uses d3-force as a HEADLESS layout solver: we seed each node on a circle
 * (stable, no `Math.random` — identical input → identical output across runs,
 * SSR and jsdom), then tick the simulation a fixed number of iterations and read
 * the settled `x/y`. The simulation is run synchronously to completion here — we
 * never start d3's internal timer (`simulation.stop()` semantics) — so there is
 * no animation loop, no `requestAnimationFrame`, and nothing DOM-bound. The
 * draw-in animation is GSAP's job in the component; this module only produces
 * coordinates.
 *
 * No d3 force reaches into the DOM, so this is safe under jsdom in tests.
 */
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
} from "d3-force";
import type { GraphData, GraphNode, GraphEdge } from "./graph-data";

/** A node with its settled position (px, within the viewBox). */
export interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

/** An edge with both endpoints resolved to their settled positions. */
export interface PositionedEdge extends GraphEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PositionedGraph {
  nodes: PositionedNode[];
  edges: PositionedEdge[];
  width: number;
  height: number;
}

/** Internal d3 datum: our node id + a mutable simulated position. */
interface SimNode extends SimulationNodeDatum {
  id: string;
}

export interface LayoutOptions {
  /** viewBox width (px). */
  width?: number;
  /** viewBox height (px). */
  height?: number;
  /** Fixed iteration count — more = more settled, still fully deterministic. */
  iterations?: number;
}

const DEFAULT_WIDTH = 760;
const DEFAULT_HEIGHT = 520;
const DEFAULT_ITERATIONS = 300;

/**
 * Compute a settled layout for the graph. Single empty/one-node graphs are
 * handled by the seeding (a node with no neighbours sits on the seed circle),
 * so this never divides by zero or loops forever.
 */
export function layoutGraph(
  graph: GraphData,
  options: LayoutOptions = {},
): PositionedGraph {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const cx = width / 2;
  const cy = height / 2;

  const count = graph.nodes.length;

  // Seed each node on a circle around the centre — deterministic, no randomness.
  // The radius scales gently with node count so denser graphs start more spread.
  const radius = Math.min(width, height) * 0.32;
  const simNodes: SimNode[] = graph.nodes.map((node, index) => {
    const angle = count > 0 ? (2 * Math.PI * index) / count : 0;
    return {
      id: node.id,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });

  const idToSim = new Map(simNodes.map((n) => [n.id, n]));

  if (count > 1) {
    const links = graph.edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
    }));

    const simulation = forceSimulation(simNodes)
      .force(
        "link",
        forceLink(links)
          .id((d) => (d as SimNode).id)
          .distance(120)
          .strength(0.4),
      )
      .force("charge", forceManyBody().strength(-420))
      .force("center", forceCenter(cx, cy))
      .force("collide", forceCollide(46))
      // Stop the internal timer immediately — we drive ticks by hand below so
      // the layout is synchronous and deterministic (no rAF, jsdom-safe).
      .stop();

    for (let i = 0; i < iterations; i += 1) simulation.tick();
  }

  // Clamp into the viewBox with a margin so nodes never sit on the edge.
  const margin = 56;
  const clamp = (value: number, max: number): number =>
    Math.max(margin, Math.min(max - margin, value));

  const nodes: PositionedNode[] = graph.nodes.map((node) => {
    const sim = idToSim.get(node.id);
    return {
      ...node,
      x: clamp(sim?.x ?? cx, width),
      y: clamp(sim?.y ?? cy, height),
    };
  });

  const nodePos = new Map(nodes.map((n) => [n.id, n]));
  const edges: PositionedEdge[] = graph.edges.map((edge) => {
    const a = nodePos.get(edge.source);
    const b = nodePos.get(edge.target);
    return {
      ...edge,
      x1: a?.x ?? cx,
      y1: a?.y ?? cy,
      x2: b?.x ?? cx,
      y2: b?.y ?? cy,
    };
  });

  return { nodes, edges, width, height };
}
