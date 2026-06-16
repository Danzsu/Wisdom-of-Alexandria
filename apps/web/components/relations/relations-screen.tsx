"use client";

/**
 * Kapcsolatok screen (UX-3a) — resolves the active book → project, loads the
 * project's codex relations + entries, assembles the graph and renders it with a
 * side detail panel. Handles every state honestly: loading, error, empty (a calm
 * create prompt, never a blank canvas), and a dangling reference (a muted node).
 *
 * Selection is local component state (the graph is a single screen, so a URL
 * param isn't needed here); clicking a node opens the detail panel.
 */
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { BrandStar } from "@/components/kit/brand-star";
import { Spinner } from "@/components/kit/spinner";
import { Button } from "@/components/kit";
import { useBookProjectId } from "@/lib/api/ai-hooks";
import { useCodexEntries, useCodexRelations } from "@/lib/api/hooks";
import { buildGraphData } from "./graph-data";
import { RelationshipGraph } from "./relationship-graph";
import { RelationDetailPanel } from "./relation-detail-panel";
import { NewRelationModal } from "./new-relation-modal";
import { hu } from "@/lib/i18n/hu";

export interface RelationsScreenProps {
  bookId: string | undefined;
}

export function RelationsScreen({ bookId }: RelationsScreenProps) {
  const projectIdQuery = useBookProjectId(bookId);
  const projectId = projectIdQuery.data;
  const relationsQuery = useCodexRelations(projectId);
  const entriesQuery = useCodexEntries(projectId);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const relations = useMemo(
    () => relationsQuery.data ?? [],
    [relationsQuery.data],
  );
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data]);

  const graph = useMemo(
    () => buildGraphData(relations, entries),
    [relations, entries],
  );

  const isLoading =
    projectIdQuery.isLoading ||
    relationsQuery.isLoading ||
    entriesQuery.isLoading;
  const isError =
    projectIdQuery.isError || relationsQuery.isError || entriesQuery.isError;

  if (isError) {
    const message = (
      projectIdQuery.error ??
      relationsQuery.error ??
      entriesQuery.error
    )?.message;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="m-0 text-[14px] font-semibold text-danger-text">
          {hu.relations.error}
        </p>
        {message ? (
          <p className="m-0 max-w-md text-[13px] text-text-muted">{message}</p>
        ) : null}
      </div>
    );
  }

  if (isLoading || !projectId) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-[13px] text-text-muted">
        <Spinner size={14} />
        {hu.relations.loading}
      </div>
    );
  }

  // Empty state — a calm prompt, not a blank canvas.
  if (graph.edges.length === 0) {
    return (
      <>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted text-accent-text">
            <BrandStar size={26} />
          </span>
          <p className="m-0 text-[15px] font-semibold text-text">
            {hu.relations.emptyTitle}
          </p>
          <p className="m-0 max-w-[360px] text-[13px] leading-[1.5] text-text-muted">
            {hu.relations.emptyHint}
          </p>
          <Button variant="cta" onClick={() => setModalOpen(true)}>
            <Plus size={15} aria-hidden />
            {hu.relations.emptyCta}
          </Button>
        </div>
        <NewRelationModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          projectId={projectId}
          entries={entries}
        />
      </>
    );
  }

  const selectedNode = selectedId
    ? graph.nodes.find((n) => n.id === selectedId)
    : undefined;

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Toolbar. */}
        <header className="flex items-center gap-3 border-b border-border px-5 py-3">
          <h1 className="m-0 font-serif text-[17px] font-semibold text-text">
            {hu.relations.title}
          </h1>
          <span className="text-[12px] text-text-muted">
            {hu.relations.nodeCount(graph.nodes.length)} ·{" "}
            {hu.relations.edgeCount(graph.edges.length)}
          </span>
          <Button
            variant="secondary"
            size={32}
            className="ml-auto"
            onClick={() => setModalOpen(true)}
          >
            <Plus size={14} aria-hidden />
            {hu.relations.addNew}
          </Button>
        </header>

        {/* The graph canvas. */}
        <div className="flex flex-1 items-center justify-center overflow-hidden p-4">
          <RelationshipGraph
            graph={graph}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      </div>

      {selectedNode ? (
        <RelationDetailPanel
          projectId={projectId}
          bookId={bookId}
          nodeId={selectedNode.id}
          entries={entries}
          relations={relations}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      <NewRelationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        projectId={projectId}
        entries={entries}
      />
    </div>
  );
}
