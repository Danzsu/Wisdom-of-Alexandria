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
import { Button, EmptyState, ErrorState, SkeletonList } from "@/components/kit";
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
    const detail = (
      projectIdQuery.error ??
      relationsQuery.error ??
      entriesQuery.error
    )?.message;
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <ErrorState
          message={hu.relations.error}
          detail={detail}
          onRetry={() => {
            void relationsQuery.refetch();
            void entriesQuery.refetch();
            if (projectIdQuery.isError) void projectIdQuery.refetch();
          }}
          className="w-full max-w-md"
        />
      </div>
    );
  }

  if (isLoading || !projectId) {
    return (
      <div className="flex flex-1 flex-col px-6 py-8">
        <SkeletonList rows={4} className="mx-auto w-full max-w-2xl" />
      </div>
    );
  }

  // Empty state — a calm prompt, not a blank canvas.
  if (graph.edges.length === 0) {
    return (
      <>
        <div className="flex flex-1 items-center justify-center px-6">
          <EmptyState
            icon={<BrandStar size={26} />}
            title={hu.relations.emptyTitle}
            description={hu.relations.emptyHint}
            action={{
              label: hu.relations.emptyCta,
              onClick: () => setModalOpen(true),
            }}
          />
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
          <h1 className="m-0 font-display text-[18px] font-semibold text-text">
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

        {/* The graph canvas — a calm surface card with a soft radial glow,
            mirroring the prototype's framed relation web. */}
        <div className="flex flex-1 items-center justify-center overflow-hidden p-6">
          <div
            className="relative h-full w-full overflow-hidden rounded-[18px] border border-border bg-surface shadow-card"
            style={{
              backgroundImage:
                "radial-gradient(60% 60% at 50% 48%, var(--surface-soft) 0%, transparent 70%)",
            }}
          >
            <RelationshipGraph
              graph={graph}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
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
