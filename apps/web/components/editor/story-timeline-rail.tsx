"use client";

import { cn } from "@/lib/utils";
import { hu } from "@/lib/i18n/hu";
import type { SceneRead } from "@/lib/api/types";

export interface TimelineScene {
  id: string;
  title: string;
  /** Tone slot for the bar: a small palette of status/pov colors. */
  tone: "success" | "pov3" | "accent" | "neutral";
}

export interface StoryTimelineRailProps {
  /** Ordered scenes across the book (flattened). */
  scenes: TimelineScene[];
  /** The currently-open scene id (rendered as the wide accent bar). */
  activeSceneId: string | undefined;
  /** Navigate to a scene when its bar is clicked. */
  onSelect: (sceneId: string) => void;
}

/** Tone → bar background class. */
function toneClass(tone: TimelineScene["tone"], active: boolean): string {
  if (active) return "bg-accent";
  switch (tone) {
    case "success":
      return "bg-success";
    case "pov3":
      return "bg-pov3-tx";
    case "neutral":
      return "bg-border-strong";
    default:
      return "bg-accent";
  }
}

/**
 * 54px vertical "IDŐSOR" rail on the right of the manuscript. Each scene is a
 * thin pill bar; the active scene renders wider with an accent ring. Clicking a
 * bar navigates to that scene. A basic version driven by the book tree (the
 * full continuity-aware timeline is V1).
 */
export function StoryTimelineRail({
  scenes,
  activeSceneId,
  onSelect,
}: StoryTimelineRailProps) {
  const activeIndex = scenes.findIndex((s) => s.id === activeSceneId);
  const position = activeIndex >= 0 ? activeIndex + 1 : 0;

  return (
    <div
      aria-label={hu.write.timelineAria}
      className="flex w-timeline-rail flex-none flex-col items-center gap-0 border-l border-border bg-bg-subtle py-3.5"
    >
      <span className="mb-2.5 [writing-mode:vertical-rl] rotate-180 text-[9px] font-semibold tracking-[0.08em] text-text-faint">
        {hu.write.timelineLabel}
      </span>
      <div className="flex w-full flex-1 flex-col items-center gap-[3px] py-1">
        {scenes.map((scene) => {
          const active = scene.id === activeSceneId;
          return (
            <button
              key={scene.id}
              type="button"
              title={scene.title}
              aria-label={scene.title}
              aria-current={active ? "true" : undefined}
              onClick={() => onSelect(scene.id)}
              className={cn(
                "min-h-[18px] flex-1 cursor-pointer rounded-full border-none p-0 transition-all",
                toneClass(scene.tone, active),
                active
                  ? "w-[10px] shadow-[0_0_0_3px_var(--accent-muted)]"
                  : "w-1.5 opacity-55 hover:w-2.5 hover:opacity-100",
              )}
            />
          );
        })}
      </div>
      <span className="mt-2 text-[9px] tabular-nums text-text-faint">
        {position}/{scenes.length}
      </span>
    </div>
  );
}

/** Map a book's flattened scenes into timeline scenes with simple tone cycling. */
export function scenesToTimeline(scenes: SceneRead[]): TimelineScene[] {
  const tones: TimelineScene["tone"][] = ["success", "pov3", "accent", "neutral"];
  return scenes.map((scene, i) => ({
    id: scene.id,
    title: scene.title,
    tone: scene.status === "complete" ? "success" : tones[i % tones.length],
  }));
}
