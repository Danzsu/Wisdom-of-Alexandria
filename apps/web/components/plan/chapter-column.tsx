"use client";

import { useState } from "react";
import { GripVertical, Plus, Sparkles } from "lucide-react";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Icon } from "@/components/kit/icon";
import { IconButton } from "@/components/kit/icon-button";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import { SceneCard } from "./scene-card";
import { GenerateChapterDialog } from "./generate-chapter-dialog";
import { dndTransformToCss } from "./dnd-transform";
import type { PlanChapter, PlanDensity } from "./types";

export interface ChapterColumnProps {
  chapter: PlanChapter;
  density: PlanDensity;
  /** The owning book id — threaded to scene cards for the metadata modal. */
  bookId: string | undefined;
  /** Disable the "+ Új jelenet" tile while a create is in flight (collision guard). */
  isCreating?: boolean;
  onOpenScene: (sceneId: string) => void;
  onCreateScene: (chapterId: string) => void;
  onChangePov: () => void;
  onDuplicateScene: (sceneId: string) => void;
  onArchiveScene: (chapterId: string, sceneId: string) => void;
  onDeleteScene: (chapterId: string, sceneId: string) => void;
}

/**
 * One chapter column (280px) in the Rács view: a sortable section (drag the grip
 * to reorder chapters) holding a vertical SortableContext of its SceneCards plus
 * a dashed "+ Új jelenet" tile. The drag-over highlight reuses `woa-chap-over`.
 */
export function ChapterColumn({
  chapter,
  density,
  bookId,
  isCreating,
  onOpenScene,
  onCreateScene,
  onChangePov,
  onDuplicateScene,
  onArchiveScene,
  onDeleteScene,
}: Readonly<ChapterColumnProps>) {
  const [genOpen, setGenOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: chapter.id, data: { type: "chapter" } });

  return (
    <section
      ref={setNodeRef}
      // Drop-target affordance hook: while ANY drag is active the grid root
      // carries `.woa-drag-active`, and `.woa-drag-active [data-col]` draws a
      // gold dashed outline on every column (see globals.css).
      data-col=""
      style={{
        transform: dndTransformToCss(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
      }}
      className={cn(
        "flex w-[280px] flex-none flex-col gap-2 rounded-xl border border-border bg-bg-subtle p-2.5",
        isOver && "woa-chap-over",
      )}
    >
      <div className="flex items-center gap-[7px] px-1 py-0.5">
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
        <span className="flex-1 truncate text-[14px] font-semibold text-text">
          {chapter.title}
        </span>
        <IconButton
          size={24}
          aria-label={hu.chapterGen.triggerAria(chapter.title)}
          onClick={() => setGenOpen(true)}
        >
          <Icon icon={Sparkles} size={13} className="text-ai" />
        </IconButton>
        <span className="flex h-[18px] items-center rounded-full bg-surface-muted px-2 text-[11px] tabular-nums text-text-muted">
          {chapter.scenes.length}
        </span>
      </div>

      {/* Mount the dialog (and its data hooks) only while open, so the closed
          board never fires the scene/beats queries and a board rendered without
          a QueryClient in tests stays inert. */}
      {genOpen ? (
        <GenerateChapterDialog
          chapterId={chapter.id}
          chapterTitle={chapter.title}
          open
          onOpenChange={setGenOpen}
        />
      ) : null}

      <div className="flex flex-col gap-2">
        <SortableContext
          items={chapter.scenes.map((s) => s.id)}
          strategy={verticalListSortingStrategy}
        >
          {chapter.scenes.map((scene, index) => (
            <SceneCard
              key={scene.id}
              scene={scene}
              index={index}
              density={density}
              bookId={bookId}
              onOpen={() => onOpenScene(scene.id)}
              onChangePov={onChangePov}
              onDuplicate={() => onDuplicateScene(scene.id)}
              onArchive={() => onArchiveScene(chapter.id, scene.id)}
              onDelete={() => onDeleteScene(chapter.id, scene.id)}
            />
          ))}
        </SortableContext>
      </div>

      <button
        type="button"
        onClick={() => onCreateScene(chapter.id)}
        disabled={isCreating}
        className="flex h-[30px] items-center justify-center gap-[5px] rounded-lg border border-dashed border-border-strong bg-transparent text-[12px] text-text-muted hover:border-accent hover:bg-accent-muted hover:text-accent-text disabled:opacity-50"
      >
        <Icon icon={Plus} size={12} />
        {hu.plan.newScene}
      </button>
    </section>
  );
}
