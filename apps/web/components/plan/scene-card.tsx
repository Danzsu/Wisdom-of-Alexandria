"use client";

import { useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { GripVertical, Info, Pencil } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { Icon } from "@/components/kit/icon";
import { cn } from "@/lib/utils";
import { useCalmMotion } from "@/lib/motion";
import { hu } from "@/lib/i18n/hu";
import { sceneStatusPresentation } from "@/lib/scene-status";
import { SceneKebab } from "./scene-kebab";
import { SceneMetadataModal } from "./scene-metadata-modal";
import { povBadgeClass } from "./pov-badge-class";
import { dndTransformToCss } from "./dnd-transform";
import type { PlanDensity, PlanScene } from "./types";

/** Card padding per density (compact tightens, slim tightens further). */
const DENSITY_PADDING: Record<PlanDensity, string> = {
  default: "p-3",
  compact: "p-[9px_11px]",
  slim: "p-[7px_11px]",
};

/**
 * Estimated card block-size per density for the `woa-card-cv` placeholder
 * (`contain-intrinsic-block-size`). Only never-rendered off-screen cards use
 * the estimate (scrollbar sizing); once a card has rendered, the browser
 * remembers its REAL height (the `auto` keyword), so a rough figure is fine.
 */
const CV_BLOCK_ESTIMATE: Record<PlanDensity, string> = {
  default: "112px",
  compact: "72px",
  slim: "40px",
};

export interface SceneCardProps {
  scene: PlanScene;
  density: PlanDensity;
  /** The owning book id — needed by the scene-metadata modal's Write route. */
  bookId: string | undefined;
  /** Position within its chapter column — drives the capped mount stagger. */
  index?: number;
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
  bookId,
  index = 0,
  onOpen,
  onChangePov,
  onDuplicate,
  onArchive,
  onDelete,
}: Readonly<SceneCardProps>) {
  const motionConf = useCalmMotion();
  const [metaOpen, setMetaOpen] = useState(false);
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

  // Design drag polish: the dragged card carries `.woa-dragging` (opacity .4 +
  // tilt + lifted shadow + grabbing cursor, see globals.css). There is NO
  // DragOverlay — this in-list node follows the pointer via dnd-kit's inline
  // transform, so the design tilt is COMPOSED into that inline transform (an
  // inline `transform` would otherwise override the class's). Before the first
  // pointer movement dnd-kit reports no transform yet — then the class's own
  // scale/rotate applies. Static states only: reduced-motion safe by nature.
  const dragTransform = dndTransformToCss(transform);
  const cardTransform =
    isDragging && dragTransform
      ? `${dragTransform} scale(0.97) rotate(-1.4deg)`
      : dragTransform;

  return (
    <>
      {/*
        Outer wrapper owns the SHORT mount fade-up (transform/opacity only); the
        inner dnd-kit node owns the drag transform — kept on separate elements so
        FM and dnd-kit never write `transform` to the same node (which would fight
        and break dragging). No FM `layout` here for the same reason. The mount
        animation is suppressed (`initial={false}`) while dragging so a reorder
        never replays the entrance. Reduced motion → zero delay / instant.

        The wrapper also carries `woa-card-cv` (content-visibility: auto —
        render scalability, see globals.css): off-screen cards skip layout +
        paint while keeping their DOM, so dnd-kit's measurements and the drag
        transform on the INNER node are unaffected. It lives here (not on the
        dnd node) so the containment never wraps the element dnd-kit measures
        and transforms.
      */}
      <motion.div
      className="woa-card-cv"
      style={
        { "--woa-cv-block": CV_BLOCK_ESTIMATE[density] } as CSSProperties
      }
      initial={
        isDragging ? false : { opacity: 0, transform: "translateY(8px)" }
      }
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{ ...motionConf.transition, delay: motionConf.childDelay(index) }}
    >
      <div
        ref={setNodeRef}
        style={{
          transform: cardTransform,
          transition,
        }}
        className={cn(
          "flex flex-col gap-2 rounded-xl border border-border bg-surface shadow-card",
          padding,
          isDragging && "woa-dragging",
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

        {bookId ? (
          <button
            type="button"
            onClick={() => setMetaOpen(true)}
            aria-label={hu.plan.sceneMetaAria}
            className="flex h-6 w-6 flex-none items-center justify-center rounded-md text-text-faint hover:bg-surface-muted hover:text-accent-text"
          >
            <Icon icon={Info} size={12} />
          </button>
        ) : null}

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
    </motion.div>

      {/* Mount the metadata modal (and its beats query) only while open, so a
          closed card never fires the per-scene beats query. */}
      {bookId && metaOpen ? (
        <SceneMetadataModal
          scene={scene}
          bookId={bookId}
          open
          onOpenChange={setMetaOpen}
        />
      ) : null}
    </>
  );
}
