"use client";

import { useCallback } from "react";
import { ChevronDown, Plus } from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Icon } from "@/components/kit/icon";
import { hu } from "@/lib/i18n/hu";
import { ChapterColumn } from "./chapter-column";
import { computeReorder } from "./reorder-logic";
import type { PlanBoardController } from "./use-plan-board";
import type { PlanDensity } from "./types";

export interface PlanGridProps {
  controller: PlanBoardController;
  density: PlanDensity;
}

/**
 * Rács (Grid) view: an act header row (the prototype groups every chapter under
 * "I. felvonás" — multi-act is M9) with a "+ Új fejezet" action, then the
 * chapter columns wrapped in a horizontal dnd-kit SortableContext. A single
 * `DndContext` handles BOTH chapter reorder and within-chapter scene reorder;
 * `onDragEnd` derives the new id order via the pure `computeReorder` helper and
 * fires the controller's optimistic reorder mutation. Pointer + keyboard sensors
 * make the dnd keyboard-accessible; the PointerSensor's 6px activation distance
 * keeps card-click (open scene) and kebab clicks working.
 */
export function PlanGrid({ controller, density }: PlanGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const { chapters, reorderChapters, reorderScenes, moveScene } = controller;

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const result = computeReorder(chapters, {
        active: { id: event.active.id },
        over: event.over ? { id: event.over.id } : null,
      });
      if (!result) return;
      if (result.kind === "chapter") {
        reorderChapters(result.order);
      } else if (result.kind === "scene") {
        reorderScenes(result.chapterId, result.order);
      } else {
        // kind === "move": a cross-chapter scene drop (P1.5).
        moveScene(
          result.sceneId,
          result.fromChapterId,
          result.toChapterId,
          result.targetIndex,
        );
      }
    },
    [chapters, reorderChapters, reorderScenes, moveScene],
  );

  return (
    <div>
      <div className="mb-3.5 flex items-center gap-2.5">
        <Icon icon={ChevronDown} size={14} className="text-text-faint" />
        <h2 className="m-0 text-[17px] font-semibold text-text">
          {hu.plan.actLabel}
        </h2>
        <button
          type="button"
          onClick={controller.createChapter}
          disabled={controller.isCreating}
          className="flex h-[26px] items-center gap-[5px] rounded-lg border border-dashed border-border-strong bg-transparent px-2.5 text-[12px] text-text-muted hover:border-gold hover:bg-gold-soft hover:text-gold-text disabled:opacity-50"
        >
          <Icon icon={Plus} size={12} />
          {hu.plan.newChapter}
        </button>
        <span className="text-[12px] tabular-nums text-text-muted">
          {hu.plan.actChapterCount(chapters.length)}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={chapters.map((c) => c.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex items-start gap-3.5">
            {chapters.map((chapter) => (
              <ChapterColumn
                key={chapter.id}
                chapter={chapter}
                density={density}
                isCreating={controller.isCreating}
                onOpenScene={controller.openScene}
                onCreateScene={controller.createScene}
                onChangePov={controller.changePov}
                onDuplicateScene={(sceneId) => {
                  const scene = chapter.scenes.find((s) => s.id === sceneId);
                  if (scene) controller.duplicateScene(scene.raw);
                }}
                onArchiveScene={controller.archiveScene}
                onDeleteScene={controller.deleteScene}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
