/**
 * Plan Board render-scalability guard. The gap audit flagged that a large board
 * (30+ chapters, hundreds of scenes) renders every card with no windowing. The
 * fix is CSS-only: scene cards carry `woa-card-cv` (`content-visibility: auto`
 * + `contain-intrinsic-block-size`, see globals.css), so off-screen cards skip
 * layout/paint while KEEPING their DOM — dnd-kit sortables stay intact.
 *
 * jsdom has no real layout, so this test cannot measure paint cost (and does
 * not pretend to). What it pins down instead:
 *  1. a 30x10 board (300 cards) renders through the REAL dnd-kit + framer-motion
 *     runtimes without error — no mocked dnd here, unlike plan-grid-dnd.test,
 *  2. every card carries the `woa-card-cv` optimization class with its
 *     per-density block-size estimate var,
 *  3. the class lives on the OUTER wrapper, not on the inner node dnd-kit
 *     measures and transforms (the two must never merge — containment on the
 *     dnd node would wrap the element dnd-kit owns).
 */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { PlanChapter, PlanScene } from "../types";
import type { PlanBoardController } from "../use-plan-board";
import { PlanGrid } from "../plan-grid";

const CHAPTER_COUNT = 30;
const SCENES_PER_CHAPTER = 10;

function scene(chapterId: string, index: number): PlanScene {
  const id = `${chapterId}-s${index}`;
  return {
    id,
    chapterId,
    index,
    title: `${index}. jelenet`,
    summary: "Egy hosszú tervezett jelenet összefoglalója.",
    status: "draft",
    pov: [],
    raw: {
      id,
      chapter_id: chapterId,
      title: `${index}. jelenet`,
      content: null,
      summary: null,
      order_index: index - 1,
      status: "draft",
      word_count: 0,
      pov_character_id: null,
      location_id: null,
      created_at: "2026-06-15T10:00:00Z",
      updated_at: "2026-06-15T10:00:00Z",
    },
  };
}

function makeChapters(): PlanChapter[] {
  return Array.from({ length: CHAPTER_COUNT }, (_, c) => {
    const id = `ch${c + 1}`;
    return {
      id,
      bookId: "book",
      index: c + 1,
      title: `${c + 1}. fejezet`,
      raw: {} as PlanChapter["raw"],
      scenes: Array.from({ length: SCENES_PER_CHAPTER }, (_, s) =>
        scene(id, s + 1),
      ),
    };
  });
}

function makeController(chapters: PlanChapter[]): PlanBoardController {
  return {
    bookId: "book",
    chapters,
    hasAnyChapter: true,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    isCreating: false,
    openScene: vi.fn(),
    createChapter: vi.fn(),
    createFirstChapter: vi.fn(),
    createScene: vi.fn(),
    reorderChapters: vi.fn(),
    reorderScenes: vi.fn(),
    moveScene: vi.fn(),
    deleteScene: vi.fn(),
    archiveScene: vi.fn(),
    duplicateScene: vi.fn(),
    changePov: vi.fn(),
  };
}

describe("Plan Board render scalability (content-visibility)", () => {
  it("renders a 30x10 board through the real dnd runtime, every card windowable", () => {
    const chapters = makeChapters();
    const { container } = render(
      <PlanGrid controller={makeController(chapters)} density="default" />,
    );

    // Every chapter column mounted (spot-check first/last).
    const text = container.textContent ?? "";
    expect(text).toContain("1. fejezet");
    expect(text).toContain("30. fejezet");

    // Every scene card carries the content-visibility class...
    const wrappers = container.querySelectorAll<HTMLElement>(".woa-card-cv");
    expect(wrappers).toHaveLength(CHAPTER_COUNT * SCENES_PER_CHAPTER);

    // ...with the default-density block-size estimate var...
    expect(wrappers[0].style.getPropertyValue("--woa-cv-block")).toBe("112px");

    // ...and the class sits on the OUTER wrapper: the inner dnd node (the
    // element with the card styling that receives the drag transform) is a
    // DESCENDANT, never the same element.
    const inner = wrappers[0].querySelector("div.rounded-xl");
    expect(inner).not.toBeNull();
    expect(wrappers[0].classList.contains("rounded-xl")).toBe(false);
  });

  it.each([
    ["compact", "72px"],
    ["slim", "40px"],
  ] as const)(
    "passes the %s-density block-size estimate to the placeholder var",
    (density, estimate) => {
      const chapters = makeChapters().slice(0, 1);
      const { container } = render(
        <PlanGrid controller={makeController(chapters)} density={density} />,
      );
      const wrapper = container.querySelector<HTMLElement>(".woa-card-cv");
      expect(wrapper).not.toBeNull();
      expect(wrapper!.style.getPropertyValue("--woa-cv-block")).toBe(estimate);
    },
  );
});
