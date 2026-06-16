"use client";

/**
 * The relationship graph (UX-3a) — a calm, literary force/radial graph rendered
 * as custom SVG (NOT React Flow; that reads techy/SaaS and breaks the brand).
 *
 * Layout: d3-force solves node positions HEADLESSLY + deterministically
 * (`graph-layout.ts`) — the SVG always renders fully on first paint, with no
 * animation required to be readable. That static render is what tests assert and
 * what `prefers-reduced-motion` users see.
 *
 * Motion (progressive enhancement only): on mount, GSAP draws the edges in
 * (stroke-dashoffset 1→0, ease-out, staggered) and fades/scales the nodes in.
 * GSAP is imported dynamically (client-only, never SSR/test bundle), scoped via
 * `gsap.context(...)` and fully reverted on unmount — no leak. Under reduced
 * motion AND under test it never runs; the static SVG IS the baseline.
 *
 * Interaction: hover/focus a node highlights its incident edges + dims the rest;
 * click selects it (drives the side detail panel via `onSelect`). Nodes are
 * focusable (`tabIndex`, role/label) so the graph is keyboard-reachable; the
 * detail panel is the non-visual fallback for the same information.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { layoutGraph, type PositionedGraph } from "./graph-layout";
import type { GraphData } from "./graph-data";
import { hu } from "@/lib/i18n/hu";
import { cn } from "@/lib/utils";

export interface RelationshipGraphProps {
  graph: GraphData;
  /** The currently selected node id (highlighted), or null. */
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
}

/** POV background CSS vars per slot — matches the avatar `pov{n}` tokens. */
const POV_FILL: Record<number, string> = {
  1: "var(--pov1-bg)",
  2: "var(--pov2-bg)",
  3: "var(--pov3-bg)",
  4: "var(--pov4-bg)",
  5: "var(--pov5-bg)",
  6: "var(--pov6-bg)",
};
const POV_TEXT: Record<number, string> = {
  1: "var(--pov1-tx)",
  2: "var(--pov2-tx)",
  3: "var(--pov3-tx)",
  4: "var(--pov4-tx)",
  5: "var(--pov5-tx)",
  6: "var(--pov6-tx)",
};

const NODE_RADIUS = 26;

/** Whether the GSAP draw-in may run: real browser, motion allowed, not test. */
function canAnimate(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "test") return false;
  if (typeof window.matchMedia !== "function") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Build initials for a node label (mirrors the Avatar helper). */
function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function RelationshipGraph({
  graph,
  selectedId,
  onSelect,
}: RelationshipGraphProps) {
  // Deterministic layout — recomputed only when the graph topology changes.
  const positioned: PositionedGraph = useMemo(() => layoutGraph(graph), [graph]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

  // The "active" node drives the highlight: hover takes precedence over the
  // persistent selection so pointer exploration feels live.
  const activeId = hoverId ?? selectedId;

  // GSAP draw-in (client-only, reduced-motion/test-gated, fully reverted).
  useEffect(() => {
    if (!canAnimate()) return;
    const root = svgRef.current;
    if (!root) return;

    let ctx: { revert: () => void } | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const gsapMod = await import("gsap");
        if (cancelled) return;
        const gsap = gsapMod.gsap ?? gsapMod.default;
        ctx = gsap.context((self) => {
          const select = self.selector as
            | ((q: string) => Element[])
            | undefined;
          if (!select) return;
          // Edges draw in: dashoffset 1→0 (each path sets its dasharray to its
          // own length via pathLength=1), staggered, ease-out, no bounce.
          gsap.fromTo(
            select("[data-rel-edge]"),
            { strokeDashoffset: 1 },
            {
              strokeDashoffset: 0,
              duration: 0.6,
              ease: "power2.out",
              stagger: 0.04,
            },
          );
          // Nodes fade + scale in gently after the edges begin.
          gsap.fromTo(
            select("[data-rel-node]"),
            { opacity: 0, scale: 0.85, transformOrigin: "center" },
            {
              opacity: 1,
              scale: 1,
              duration: 0.4,
              ease: "power2.out",
              stagger: 0.03,
              delay: 0.1,
            },
          );
        }, root);
      } catch {
        // GSAP chunk unavailable (offline): the static SVG already rendered, so
        // the graph stays fully readable. Log rather than swallow silently.
        if (!cancelled) {
          console.warn(
            "[relationship-graph] GSAP unavailable; static graph in use.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      if (ctx) ctx.revert();
    };
    // Re-run when topology changes so a freshly added edge/node animates in.
  }, [positioned]);

  const { width, height, nodes, edges } = positioned;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      role="group"
      aria-label={hu.relations.graphAriaLabel}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Edges first so nodes paint on top. */}
      <g>
        {edges.map((edge) => {
          const incident =
            activeId !== null &&
            (edge.source === activeId || edge.target === activeId);
          const dimmed = activeId !== null && !incident;
          const midX = (edge.x1 + edge.x2) / 2;
          const midY = (edge.y1 + edge.y2) / 2;
          return (
            <g key={edge.id} opacity={dimmed ? 0.18 : 1}>
              <line
                data-rel-edge
                x1={edge.x1}
                y1={edge.y1}
                x2={edge.x2}
                y2={edge.y2}
                stroke={incident ? "var(--accent)" : "var(--border)"}
                strokeWidth={incident ? 2 : 1.5}
                // pathLength=1 normalises dasharray so the GSAP 1→0 offset draws
                // the whole line regardless of its pixel length.
                pathLength={1}
                strokeDasharray={1}
              />
              <text
                x={midX}
                y={midY - 4}
                textAnchor="middle"
                className="select-none font-sans text-[10px]"
                fill="var(--text-muted)"
              >
                {edge.label}
              </text>
            </g>
          );
        })}
      </g>

      {/* Nodes. */}
      <g>
        {nodes.map((node) => {
          const isActive = node.id === activeId;
          const dimmed = activeId !== null && !isActive;
          const fill = node.missing
            ? "var(--surface-muted)"
            : POV_FILL[node.pov];
          const textFill = node.missing
            ? "var(--text-muted)"
            : POV_TEXT[node.pov];
          const label = node.missing ? hu.relations.missingNode : node.label;
          return (
            <g
              key={node.id}
              data-rel-node
              transform={`translate(${node.x}, ${node.y})`}
              opacity={dimmed ? 0.4 : 1}
              role="button"
              tabIndex={0}
              aria-label={`${label}${node.missing ? ` — ${hu.relations.missingHint}` : ""}`}
              aria-pressed={node.id === selectedId}
              className="cursor-pointer outline-none"
              onClick={() => onSelect(node.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(node.id);
                }
              }}
              onMouseEnter={() => setHoverId(node.id)}
              onMouseLeave={() => setHoverId(null)}
              onFocus={() => setHoverId(node.id)}
              onBlur={() => setHoverId(null)}
            >
              <circle
                r={NODE_RADIUS}
                fill={fill}
                stroke={isActive ? "var(--accent)" : "var(--surface)"}
                strokeWidth={isActive ? 3 : 2}
                strokeDasharray={node.missing ? "3 3" : undefined}
                className={cn(node.missing && "opacity-90")}
              />
              <text
                textAnchor="middle"
                dy="0.35em"
                className="pointer-events-none select-none font-sans text-[12px] font-bold"
                fill={textFill}
              >
                {node.missing ? "?" : initialsFrom(node.label)}
              </text>
              <text
                y={NODE_RADIUS + 14}
                textAnchor="middle"
                className="pointer-events-none select-none font-sans text-[11px]"
                fill="var(--text)"
              >
                {label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
