"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useCalmMotion } from "@/lib/motion";
import { StatusDot } from "./status-dot";

/** A run of unchanged text. */
export interface DiffEqualSegment {
  type: "equal";
  text: string;
}
/** A deletion (original side). */
export interface DiffDeletionSegment {
  type: "deletion";
  text: string;
}
/** An addition (suggestion side). */
export interface DiffAdditionSegment {
  type: "addition";
  text: string;
}

export type DiffSegment =
  | DiffEqualSegment
  | DiffDeletionSegment
  | DiffAdditionSegment;

/** Deleted span: danger-muted bg, danger-text, struck through. */
export function DiffDeletion({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[3px] bg-danger-muted px-0.5 text-danger-text line-through decoration-danger">
      {children}
    </span>
  );
}

/** Added span: success-muted bg, success-text. */
export function DiffAddition({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-[3px] bg-success-muted px-0.5 text-success-text">
      {children}
    </span>
  );
}

/** Render one segment, wrapping deletions/additions in the styled spans. */
function renderSegment(segment: DiffSegment, index: number): ReactNode {
  if (segment.type === "deletion") {
    return <DiffDeletion key={index}>{segment.text}</DiffDeletion>;
  }
  if (segment.type === "addition") {
    return <DiffAddition key={index}>{segment.text}</DiffAddition>;
  }
  return <span key={index}>{segment.text}</span>;
}

export interface DiffPaneProps {
  /** Header label for the original (left) pane. */
  originalLabel?: string;
  /** Header label for the suggestion (right) pane. */
  suggestionLabel?: string;
  /** Original-side segments (renders deletions). */
  original: DiffSegment[];
  /** Suggestion-side segments (renders additions). */
  suggestion: DiffSegment[];
  className?: string;
}

/** A single labelled pane (header + scrolling body). */
function Pane({
  label,
  dot,
  dotLabel,
  headerClassName,
  labelClassName,
  segments,
  borderRight,
}: {
  label: string;
  dot: "danger" | "success";
  dotLabel: string;
  headerClassName: string;
  labelClassName: string;
  segments: DiffSegment[];
  borderRight?: boolean;
}) {
  const motionConf = useCalmMotion();
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col",
        borderRight && "border-r border-border",
      )}
    >
      <div
        className={cn(
          "flex h-[38px] flex-none items-center gap-[7px] border-b border-border px-[18px]",
          headerClassName,
        )}
      >
        <StatusDot variant={dot} size={8} aria-label={dotLabel} />
        <span className={cn("text-[12px] font-semibold", labelClassName)}>
          {label}
        </span>
      </div>
      {/* Stagger container: the changed (add/deletion) segments fade/slide in
          subtly in sequence; unchanged runs render flat so the body reads as
          prose. Reduced motion → the no-op child variant renders everything
          instantly. Each segment is a span-level motion node so inline flow is
          preserved (transform/opacity only — never layout). */}
      <motion.div
        className="min-h-0 flex-1 overflow-y-auto px-[22px] py-5 font-serif text-[14px] leading-[1.75] text-text"
        variants={motionConf.staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {segments.map((segment, index) =>
          segment.type === "equal" ? (
            renderSegment(segment, index)
          ) : (
            <motion.span
              key={index}
              className="inline"
              variants={motionConf.staggerChild}
            >
              {renderSegment(segment, index)}
            </motion.span>
          ),
        )}
      </motion.div>
    </div>
  );
}

/**
 * Two equal side-by-side panes for a text diff. The left pane (Eredeti) carries
 * a danger dot and renders deletions; the right (AI-javaslat) carries a success
 * dot and renders additions. Body text is Literata 14/1.75. Accepts structured
 * segment arrays; use the exported `DiffDeletion` / `DiffAddition` spans for ad
 * hoc inline diffing.
 */
export function DiffPane({
  originalLabel = "Eredeti",
  suggestionLabel = "AI-javaslat",
  original,
  suggestion,
  className,
}: DiffPaneProps) {
  return (
    <div className={cn("flex min-h-0 flex-1", className)}>
      <Pane
        label={originalLabel}
        dot="danger"
        dotLabel="Eredeti"
        headerClassName="bg-surface-soft"
        labelClassName="text-text-muted"
        segments={original}
        borderRight
      />
      <Pane
        label={suggestionLabel}
        dot="success"
        dotLabel="AI-javaslat"
        headerClassName="bg-success-muted"
        labelClassName="text-success-text"
        segments={suggestion}
      />
    </div>
  );
}
