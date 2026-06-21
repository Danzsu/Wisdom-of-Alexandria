"use client";

/**
 * A single plotline card (Plotline-b). Shows the title, a status pill, the
 * description and the attached scenes as chips that deep-link to each scene's
 * Write view. Edit / delete live in the card header; attach opens the
 * scene-picker modal.
 *
 * The attached-scene list is fetched per-plotline (`usePlotlineScenes`) and the
 * `scene_id`s are resolved to titles + Write routes via the book tree map passed
 * down from the screen. An unresolved id degrades to a muted "unknown scene"
 * chip (no deep link) rather than vanishing or crashing.
 */
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  Button,
  IconButton,
  StatusPill,
  Spinner,
  ConfirmDialog,
  toast,
} from "@/components/kit";
import { Card } from "@/components/kit/card";
import {
  usePlotlineScenes,
  useDetachPlotlineScene,
  useDeletePlotline,
} from "@/lib/api/hooks";
import { routes } from "@/lib/routes";
import { hu } from "@/lib/i18n/hu";
import type { PlotlineRead } from "@/lib/api/types";
import { plotlineStatusVariant } from "./status-style";

/** A resolved scene (id → title + Write href). */
export interface SceneRef {
  id: string;
  title: string;
}

export interface PlotlineCardProps {
  projectId: string;
  bookId: string | undefined;
  plotline: PlotlineRead;
  /** Resolve a scene id to its title (from the book tree); undefined if unknown. */
  sceneById: Map<string, SceneRef>;
  onEdit: (plotline: PlotlineRead) => void;
  /** Open the attach-scene picker for this plotline (the screen owns the modal). */
  onAttach: (plotline: PlotlineRead, attachedSceneIds: Set<string>) => void;
}

export function PlotlineCard({
  projectId,
  bookId,
  plotline,
  sceneById,
  onEdit,
  onAttach,
}: Readonly<PlotlineCardProps>) {
  const scenesQuery = usePlotlineScenes(plotline.id);
  const detachScene = useDetachPlotlineScene();
  const deletePlotline = useDeletePlotline();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const links = useMemo(() => scenesQuery.data ?? [], [scenesQuery.data]);
  const attachedIds = useMemo(
    () => new Set(links.map((l) => l.scene_id)),
    [links],
  );

  function handleDetach(sceneId: string) {
    detachScene.mutate(
      { plotlineId: plotline.id, sceneId },
      {
        onSuccess: () => toast.success(hu.plotlines.detachedToast),
        onError: () => toast.error(hu.plotlines.detachError),
      },
    );
  }

  function handleDelete() {
    deletePlotline.mutate(
      { projectId, plotlineId: plotline.id },
      {
        onSuccess: () => toast.success(hu.plotlines.deleted),
        onError: () => toast.error(hu.plotlines.deleteError),
      },
    );
  }

  function renderScenes() {
    if (scenesQuery.isLoading) {
      return (
        <span className="flex items-center gap-2 text-[12px] text-text-muted">
          <Spinner size={12} />
          {hu.plotlines.loading}
        </span>
      );
    }
    if (links.length === 0) {
      return (
        <p className="m-0 text-[12px] text-text-muted">
          {hu.plotlines.noScenes}
        </p>
      );
    }
    return (
      <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
        {links.map((link) => {
          const scene = sceneById.get(link.scene_id);
          const label = scene?.title ?? hu.plotlines.unknownScene;
          let href: string | null = null;
          if (scene && bookId) {
            href = routes.scene(bookId, link.scene_id);
          }
          return (
            <li key={link.id}>
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted py-0.5 pl-2.5 pr-1 text-[12px] text-text">
                {href ? (
                  <a
                    href={href}
                    aria-label={hu.plotlines.openSceneAria(label)}
                    className="truncate text-text no-underline hover:text-accent-text focus-visible:text-accent-text"
                  >
                    {label}
                  </a>
                ) : (
                  <span className="truncate text-text-faint">{label}</span>
                )}
                <IconButton
                  size={24}
                  aria-label={hu.plotlines.detachSceneAria(label)}
                  onClick={() => handleDetach(link.scene_id)}
                >
                  <X size={12} aria-hidden />
                </IconButton>
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 truncate font-serif text-[15px] font-semibold text-text">
              {plotline.title}
            </h3>
            <StatusPill
              variant={plotlineStatusVariant(plotline.status)}
              size={18}
              className="flex-none"
            >
              {hu.plotlines.status[plotline.status] ?? plotline.status}
            </StatusPill>
            <span className="flex-none text-[11px] text-text-faint">
              {plotline.book_id
                ? hu.plotlines.bookScopeLabel
                : hu.plotlines.projectScopeLabel}
            </span>
          </div>
          {plotline.description ? (
            <p className="m-0 mt-1.5 text-[13px] leading-[1.5] text-text-soft">
              {plotline.description}
            </p>
          ) : null}
        </div>

        <div className="flex flex-none items-center gap-1">
          <IconButton
            aria-label={hu.plotlines.editAria(plotline.title)}
            onClick={() => onEdit(plotline)}
          >
            <Pencil size={15} aria-hidden />
          </IconButton>
          <IconButton
            aria-label={hu.plotlines.deleteAria(plotline.title)}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 size={15} aria-hidden />
          </IconButton>
        </div>
      </div>

      {/* Attached scenes. */}
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-[12px] font-semibold text-text-muted">
            {hu.plotlines.scenesHeading}
          </span>
          <Button
            variant="ghost"
            size={28}
            className="ml-auto"
            onClick={() => onAttach(plotline, attachedIds)}
          >
            <Plus size={13} aria-hidden />
            {hu.plotlines.attachScene}
          </Button>
        </div>

        {renderScenes()}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={hu.plotlines.deleteConfirmTitle(plotline.title)}
        description={hu.plotlines.deleteConfirmBody}
        confirmLabel={hu.plotlines.deleteConfirm}
        cancelLabel={hu.plotlines.modalCancel}
        onConfirm={handleDelete}
      />
    </Card>
  );
}
