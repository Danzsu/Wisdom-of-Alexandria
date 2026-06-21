"use client";

/**
 * Cselekményszálak (subplots) screen (Plotline-b) — resolves the active book →
 * project, lists the project's plotlines GROUPED by type, and renders each as a
 * card with a status pill, description and attached-scene chips that deep-link to
 * the scene's Write view. Create / edit a plotline (modal) and attach / detach
 * scenes (a picker of the book's scenes).
 *
 * The route only carries `bookId`; the owning project is resolved via the reused
 * `useBookProjectId` resolver (mirroring Kapcsolatok / Idősor). Scene titles +
 * Write routes are resolved from the EXISTING book tree (`useBookTree`) — no new
 * scene endpoint needed.
 *
 * State handling mirrors Kapcsolatok / Idősor: honest loading / error (with
 * retry) / empty (a calm BrandStar prompt + CTA, never a blank canvas).
 */
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { BrandStar } from "@/components/kit/brand-star";
import { Spinner } from "@/components/kit/spinner";
import { Button } from "@/components/kit";
import { useBookProjectId } from "@/lib/api/ai-hooks";
import { usePlotlines, useBookTree } from "@/lib/api/hooks";
import { PLOTLINE_TYPES, type PlotlineRead } from "@/lib/api/types";
import { hu } from "@/lib/i18n/hu";
import { PlotlineCard, type SceneRef } from "./plotline-card";
import { PlotlineModal } from "./plotline-modal";
import { AttachSceneModal, type AttachableScene } from "./attach-scene-modal";

export interface PlotlinesScreenProps {
  bookId: string | undefined;
}

/** A plotline being attached-to, with the set of scene ids already attached. */
interface AttachTarget {
  plotline: PlotlineRead;
  attachedIds: Set<string>;
}

export function PlotlinesScreen({ bookId }: Readonly<PlotlinesScreenProps>) {
  const projectIdQuery = useBookProjectId(bookId);
  const projectId = projectIdQuery.data;
  const plotlinesQuery = usePlotlines(projectId);
  // The book tree resolves attached scene ids → titles + Write routes and feeds
  // the attach picker. Book-scoped; a tree error never blocks the plotline list.
  const tree = useBookTree(bookId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PlotlineRead | null>(null);
  const [attachTarget, setAttachTarget] = useState<AttachTarget | null>(null);

  const plotlines = useMemo(
    () => plotlinesQuery.data ?? [],
    [plotlinesQuery.data],
  );

  // Every scene in the book, keyed by id (chips + the attach picker).
  const sceneById = useMemo(() => {
    const map = new Map<string, SceneRef>();
    for (const chapter of tree.chapters) {
      for (const scene of chapter.scenes) {
        map.set(scene.id, { id: scene.id, title: scene.title });
      }
    }
    return map;
  }, [tree.chapters]);

  // Plotlines grouped by type, preserving the canonical type order; each group's
  // members keep their server order (order_index then created order).
  const groups = useMemo(() => {
    const sorted = [...plotlines].sort(
      (a, b) =>
        a.order_index - b.order_index ||
        a.created_at.localeCompare(b.created_at),
    );
    return PLOTLINE_TYPES.map((type) => ({
      type,
      items: sorted.filter((p) => p.plotline_type === type),
    })).filter((g) => g.items.length > 0);
  }, [plotlines]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(plotline: PlotlineRead) {
    setEditing(plotline);
    setModalOpen(true);
  }

  function openAttach(plotline: PlotlineRead, attachedIds: Set<string>) {
    setAttachTarget({ plotline, attachedIds });
  }

  // The book's scenes not yet attached to the target plotline.
  const attachableScenes = useMemo<AttachableScene[]>(() => {
    if (!attachTarget) return [];
    const out: AttachableScene[] = [];
    for (const chapter of tree.chapters) {
      for (const scene of chapter.scenes) {
        if (!attachTarget.attachedIds.has(scene.id)) {
          out.push({ id: scene.id, title: scene.title });
        }
      }
    }
    return out;
  }, [attachTarget, tree.chapters]);

  const isLoading = projectIdQuery.isLoading || plotlinesQuery.isLoading;
  const isError = projectIdQuery.isError || plotlinesQuery.isError;

  if (isError) {
    const message = (projectIdQuery.error ?? plotlinesQuery.error)?.message;
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="m-0 text-[14px] font-semibold text-danger-text">
          {hu.plotlines.error}
        </p>
        {message ? (
          <p className="m-0 max-w-md text-[13px] text-text-muted">{message}</p>
        ) : null}
        <Button
          variant="secondary"
          size={32}
          onClick={() => {
            void plotlinesQuery.refetch();
            if (projectIdQuery.isError) void projectIdQuery.refetch();
          }}
        >
          {hu.plotlines.retry}
        </Button>
      </div>
    );
  }

  if (isLoading || !projectId) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-[13px] text-text-muted">
        <Spinner size={14} />
        {hu.plotlines.loading}
      </div>
    );
  }

  // Empty — a calm prompt, not a blank canvas.
  if (plotlines.length === 0) {
    return (
      <>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted text-accent-text">
            <BrandStar size={26} />
          </span>
          <p className="m-0 text-[15px] font-semibold text-text">
            {hu.plotlines.emptyTitle}
          </p>
          <p className="m-0 max-w-[360px] text-[13px] leading-[1.5] text-text-muted">
            {hu.plotlines.emptyHint}
          </p>
          <Button variant="cta" onClick={openCreate}>
            <Plus size={15} aria-hidden />
            {hu.plotlines.emptyCta}
          </Button>
        </div>
        <PlotlineModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          projectId={projectId}
          bookId={bookId}
          plotline={editing}
        />
      </>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Toolbar. */}
      <header className="flex items-center gap-3 border-b border-border px-5 py-3">
        <h1 className="m-0 font-serif text-[17px] font-semibold text-text">
          {hu.plotlines.title}
        </h1>
        <span className="text-[12px] text-text-muted">
          {hu.plotlines.count(plotlines.length)}
        </span>
        <Button
          variant="secondary"
          size={32}
          className="ml-auto"
          onClick={openCreate}
        >
          <Plus size={14} aria-hidden />
          {hu.plotlines.addNew}
        </Button>
      </header>

      {/* Grouped list. */}
      <div
        className="flex-1 overflow-y-auto px-6 py-6"
        role="region"
        aria-label={hu.plotlines.listAriaLabel}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          {groups.map((group) => (
            <section key={group.type}>
              <h2 className="m-0 mb-3 font-sans text-[12px] font-bold uppercase tracking-wide text-text-muted">
                {hu.plotlines.type[group.type] ?? group.type}
              </h2>
              <div className="flex flex-col gap-3">
                {group.items.map((plotline) => (
                  <PlotlineCard
                    key={plotline.id}
                    projectId={projectId}
                    bookId={bookId}
                    plotline={plotline}
                    sceneById={sceneById}
                    onEdit={openEdit}
                    onAttach={openAttach}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <PlotlineModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        projectId={projectId}
        bookId={bookId}
        plotline={editing}
      />

      {attachTarget ? (
        <AttachSceneModal
          open={Boolean(attachTarget)}
          onOpenChange={(next) => {
            if (!next) setAttachTarget(null);
          }}
          plotlineId={attachTarget.plotline.id}
          scenes={attachableScenes}
        />
      ) : null}
    </div>
  );
}
