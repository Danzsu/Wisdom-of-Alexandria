"use client";

import { GripVertical, Pencil } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { Icon } from "@/components/kit/icon";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import { sceneStatusPresentation } from "@/lib/scene-status";
import { SceneKebab } from "./scene-kebab";
import { povBadgeClass } from "./pov-badge-class";
import { dndTransformToCss } from "./dnd-transform";
import type { PlanDensity, PlanScene } from "./types";

/** Card padding per density (compact tightens, slim tightens further). */
const DENSITY_PADDING: Record<PlanDensity, string> = {
  default: "p-3",
  compact: "p-[9px_11px]",
  slim: "p-[7px_11px]",
};

export interface SceneCardProps {
  scene: PlanScene;
  density: PlanDensity;
  onOpen: () => void;
  onChangePov: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

/**
 * A single scene card in the Rács (Grid) view. Sortable via dnd-kit (the grip
 * handle carries the drag listeners; the rest of the card is clickable to open
 * the scene). Header: grip · "N. jelenet"/title · status pill (dot + label) ·
 * open-for-writing button · kebab. Body: the summary (Literata serif). Footer:
 * POV badges. Density: `compact` hides the summary, `slim` hides summary + POV.
 * The drag-over highlight reuses the prototype `woa-scene-over` class.
 */
export function SceneCard({
  scene,
  density,
  onOpen,
  onChangePov,
  onDuplicate,
  onArchive,
  onDelete,
}: SceneCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    // Only `id` and `type` are consumed: `computeReorder` resolves the owning
    // chapter by scanning the board model from the active scene id (a scene can
    // only reorder within its chapter), so attaching `chapterId` here would be
    // dead metadata implying a cross-chapter move that the backend cannot honour.
    id: scene.id,
    data: { type: "scene" },
  });

  const status = sceneStatusPresentation(scene.status);
  const showSummary = density === "default";
  const showPov = density !== "slim";
  const padding = DENSITY_PADDING[density];

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: dndTransformToCss(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
      }}
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-surface shadow-card",
        padding,
        isOver && "woa-scene-over",
      )}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          ref={setActivatorNodeRef}
          aria-label={hu.plan.dragHandleAria}
          className="flex flex-none cursor-grab items-center text-text-faint hover:text-text-muted active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <Icon icon={GripVertical} size={12} />
        </button>

        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-text hover:text-accent-text"
        >
          {scene.title}
        </button>

        <span className="flex h-[18px] flex-none items-center gap-[5px] rounded-full bg-surface-muted px-2 text-[10px] font-semibold text-text-muted">
          <span
            className={cn("h-[7px] w-[7px] rounded-full", status.dotClass)}
            aria-hidden="true"
          />
          {status.label}
        </span>

        <button
          type="button"
          onClick={onOpen}
          aria-label={hu.plan.openSceneAria}
          className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-text-faint hover:bg-surface-muted hover:text-accent-text"
        >
          <Icon icon={Pencil} size={12} />
        </button>

        <SceneKebab
          scene={scene}
          onOpen={onOpen}
          onChangePov={onChangePov}
          onDuplicate={onDuplicate}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      </div>

      {showSummary ? (
        <p
          className={cn(
            "m-0 font-serif text-[13px] leading-[1.55]",
            scene.summary ? "text-text-soft" : "italic text-text-faint",
          )}
        >
          {scene.summary || hu.plan.summaryPlaceholder}
        </p>
      ) : null}

      {showPov && scene.pov.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {scene.pov.map((badge) => (
            <span
              key={badge.label}
              className={cn(
                "flex h-[19px] items-center rounded-full px-2 text-[11px] font-semibold",
                povBadgeClass(badge.slot),
              )}
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
