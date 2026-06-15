import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  StoryTimelineRail,
  scenesToTimeline,
  type TimelineScene,
} from "@/components/editor/story-timeline-rail";
import type { SceneRead } from "@/lib/api/types";

const SCENES: TimelineScene[] = [
  { id: "s1", title: "Első jelenet", tone: "success" },
  { id: "s2", title: "Második jelenet", tone: "pov3" },
  { id: "s3", title: "Harmadik jelenet", tone: "accent" },
];

describe("StoryTimelineRail", () => {
  it("labels each scene bar and marks the active one with aria-current", () => {
    render(
      <StoryTimelineRail scenes={SCENES} activeSceneId="s2" onSelect={() => {}} />,
    );
    const active = screen.getByRole("button", { name: "Második jelenet" });
    expect(active).toHaveAttribute("aria-current", "true");
    expect(
      screen.getByRole("button", { name: "Első jelenet" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("gives each bar a ≥24px touch/pointer hit area", () => {
    render(
      <StoryTimelineRail scenes={SCENES} activeSceneId="s1" onSelect={() => {}} />,
    );
    const bar = screen.getByRole("button", { name: "Első jelenet" });
    // The button is the wide transparent hit target; the slim coloured pill is
    // an inner aria-hidden span. The button enforces the ≥24px minimums.
    expect(bar.className).toContain("min-h-[24px]");
    expect(bar.className).toContain("min-w-[24px]");
    expect(bar.className).toContain("w-full");
  });

  it("navigates to a scene when its bar is clicked", async () => {
    const onSelect = vi.fn();
    render(
      <StoryTimelineRail scenes={SCENES} activeSceneId="s1" onSelect={onSelect} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Harmadik jelenet" }));
    expect(onSelect).toHaveBeenCalledWith("s3");
  });
});

describe("scenesToTimeline", () => {
  it("maps complete scenes to the success tone and keeps id/title", () => {
    const scenes = [
      { id: "a", title: "A", status: "complete" },
      { id: "b", title: "B", status: "draft" },
    ] as unknown as SceneRead[];
    const result = scenesToTimeline(scenes);
    expect(result[0]).toMatchObject({ id: "a", title: "A", tone: "success" });
    expect(result[1].tone).not.toBe("success");
  });
});
