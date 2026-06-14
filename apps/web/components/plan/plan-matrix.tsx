"use client";

import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import { MATRIX_COLUMNS, sceneStatusPresentation } from "@/lib/scene-status";
import type { PlanBoardController } from "./use-plan-board";
import type { PlanChapter, PlanScene } from "./types";

export interface PlanMatrixProps {
  controller: PlanBoardController;
}

/** The chip colour per matrix column index (status), mirroring the prototype. */
const CHIP_CLASS: Record<number, string> = {
  0: "bg-surface-muted text-text-muted border border-border",
  1: "bg-accent-muted text-accent-text",
  2: "bg-pov3-bg text-pov3-tx",
  3: "bg-success-muted text-success-text",
};

/**
 * Mátrix view: a CSS grid with a label column + the four status columns
 * (Tervezett / Piszkozat / Elkészült / Végleges). Each chapter is a row; its
 * scenes are placed as clickable chips under the column matching their status.
 * Clicking a chip opens that scene in the editor.
 */
export function PlanMatrix({ controller }: PlanMatrixProps) {
  const { chapters, openScene } = controller;

  return (
    <div>
      <div
        className="grid min-w-[760px] gap-px overflow-hidden rounded-xl border border-border bg-border"
        style={{ gridTemplateColumns: "170px repeat(4, 1fr)" }}
      >
        {/* Header row */}
        <div className="bg-bg-subtle px-3.5 py-[11px] text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
          {hu.plan.matrixChapterColLabel}
        </div>
        {MATRIX_COLUMNS.map((col) => (
          <div
            key={col.label}
            className="flex items-center gap-1.5 bg-bg-subtle px-3.5 py-[11px] text-[11px] font-semibold text-text-muted"
          >
            <span
              className={cn("h-2 w-2 rounded-full", col.dotClass)}
              aria-hidden="true"
            />
            {col.label}
          </div>
        ))}

        {/* One row per chapter */}
        {chapters.map((chapter) => (
          <MatrixRow
            key={chapter.id}
            chapter={chapter}
            onOpenScene={openScene}
          />
        ))}
      </div>
      <p className="mt-3.5 text-[12px] text-text-muted">{hu.plan.matrixHint}</p>
    </div>
  );
}

/** One chapter row: label cell + four status cells holding the scene chips. */
function MatrixRow({
  chapter,
  onOpenScene,
}: {
  chapter: PlanChapter;
  onOpenScene: (sceneId: string) => void;
}) {
  // Bucket the chapter's scenes by their matrix column (status).
  const buckets: PlanScene[][] = [[], [], [], []];
  for (const scene of chapter.scenes) {
    const col = sceneStatusPresentation(scene.status).matrixColumn;
    buckets[col].push(scene);
  }

  return (
    <>
      <div className="flex items-center bg-surface px-3.5 py-[13px] text-[13px] font-semibold text-text">
        {chapter.title}
      </div>
      {buckets.map((scenes, col) => (
        <div
          key={col}
          className="flex flex-wrap items-start gap-[5px] bg-surface p-2.5"
        >
          {scenes.map((scene) => (
            <button
              key={scene.id}
              type="button"
              onClick={() => onOpenScene(scene.id)}
              className={cn(
                "flex h-[22px] items-center rounded-[7px] px-[9px] text-[11px] font-semibold",
                CHIP_CLASS[col],
              )}
            >
              {hu.plan.sceneNumber(scene.index)}
            </button>
          ))}
        </div>
      ))}
    </>
  );
}
