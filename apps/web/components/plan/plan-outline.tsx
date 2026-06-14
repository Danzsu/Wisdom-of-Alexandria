"use client";

import { ChevronDown } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import type { PlanBoardController } from "./use-plan-board";

export interface PlanOutlineProps {
  controller: PlanBoardController;
  /** The active scene id (from the route), marked "· jelenlegi" when present. */
  activeSceneId?: string;
}

/**
 * Vázlat (Outline) view: a narrow (max-w 680) column with an act header, then
 * each chapter (border-left rail) listing its scenes as numbered buttons. The
 * current scene (if any) is accent-bordered with a "· jelenlegi" marker.
 * Clicking a scene opens it in the editor.
 */
export function PlanOutline({ controller, activeSceneId }: PlanOutlineProps) {
  const { chapters, openScene } = controller;

  return (
    <div className="max-w-[680px]">
      <div className="mb-2.5 flex items-center gap-2">
        <Icon icon={ChevronDown} size={15} className="text-accent" />
        <h2 className="m-0 text-[16px] font-bold text-text">
          {hu.plan.actLabel}
        </h2>
      </div>

      <div className="ml-1.5 flex flex-col gap-[18px] border-l-2 border-border pl-[18px]">
        {chapters.map((chapter) => (
          <div key={chapter.id}>
            <p className="m-0 mb-[7px] text-[13px] font-semibold text-accent-text">
              {chapter.title}
            </p>
            <div className="flex flex-col gap-[5px]">
              {chapter.scenes.map((scene) => {
                const active = scene.id === activeSceneId;
                return (
                  <button
                    key={scene.id}
                    type="button"
                    onClick={() => openScene(scene.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex items-baseline gap-[9px] rounded-lg px-2 py-[5px] text-left",
                      active
                        ? "border border-accent bg-surface"
                        : "border-none bg-transparent hover:bg-surface-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex-none text-[12px] tabular-nums",
                        active
                          ? "font-semibold text-accent-text"
                          : "text-text-faint",
                      )}
                    >
                      {scene.index}.
                    </span>
                    <span
                      className={cn(
                        "text-[14px] leading-[1.5]",
                        scene.summary ? "text-text-soft" : "text-text",
                      )}
                    >
                      {scene.summary || scene.title}
                      {active ? (
                        <span className="font-semibold text-accent-text">
                          {" "}
                          {hu.plan.outlineCurrent}
                        </span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
