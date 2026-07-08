/**
 * Plan-board drag visuals (2026-07 design canvas refresh — drag polish).
 *
 * Design contract (.superpowers/sdd/design/Alexandria.latest.html):
 *  - the DRAGGED scene card carries `.woa-dragging` (opacity .4 + tilt +
 *    lifted shadow + grabbing cursor). Our board has NO DragOverlay — the
 *    in-list original follows the pointer via dnd-kit's transform, so that one
 *    node carries the whole treatment, with the tilt composed into the inline
 *    drag transform (an inline `transform` would otherwise override the class).
 *  - while ANY drag is active, the columns wrapper carries `.woa-drag-active`
 *    and every chapter column carries `data-col`, so the CSS can draw the gold
 *    dashed drop-target outline on all columns.
 *
 * Real pointer drags are flaky in jsdom, so this follows the established
 * plan-grid-dnd pattern: mock @dnd-kit to (a) capture the DndContext handlers
 * PlanGrid wires up and (b) steer `useSortable().isDragging` per id.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render } from "@testing-library/react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import type { PlanChapter, PlanScene } from "../types";
import type { PlanBoardController } from "../use-plan-board";

// Which sortable id is currently "dragging" (steers the useSortable mock).
let draggingId: string | null = null;
// Captured DndContext lifecycle handlers.
let capturedOnDragStart: ((event: DragStartEvent) => void) | null = null;
let capturedOnDragEnd: ((event: DragEndEvent) => void) | null = null;
let capturedOnDragCancel: (() => void) | null = null;

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragEnd,
    onDragCancel,
  }: {
    children: React.ReactNode;
    onDragStart?: (event: DragStartEvent) => void;
    onDragEnd: (event: DragEndEvent) => void;
    onDragCancel?: () => void;
  }) => {
    capturedOnDragStart = onDragStart ?? null;
    capturedOnDragEnd = onDragEnd;
    capturedOnDragCancel = onDragCancel ?? null;
    return <div>{children}</div>;
  },
  KeyboardSensor: class {},
  PointerSensor: class {},
  closestCenter: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useSortable: ({ id }: { id: string }) => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    setActivatorNodeRef: vi.fn(),
    // The active sortable follows the pointer via a dnd transform.
    transform: id === draggingId ? { x: 10, y: 20, scaleX: 1, scaleY: 1 } : null,
    transition: undefined,
    isDragging: id === draggingId,
    isOver: false,
  }),
  horizontalListSortingStrategy: vi.fn(),
  verticalListSortingStrategy: vi.fn(),
  sortableKeyboardCoordinates: vi.fn(),
}));

import { PlanGrid } from "../plan-grid";

function scene(id: string, chapterId: string, index: number): PlanScene {
  return {
    id,
    chapterId,
    index,
    title: `${index}. jelenet`,
    summary: null,
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

const chapters: PlanChapter[] = [
  {
    id: "ch1",
    bookId: "book",
    index: 1,
    title: "I. fejezet",
    raw: {} as PlanChapter["raw"],
    scenes: [scene("s1", "ch1", 1), scene("s2", "ch1", 2)],
  },
  {
    id: "ch2",
    bookId: "book",
    index: 2,
    title: "II. fejezet",
    raw: {} as PlanChapter["raw"],
    scenes: [scene("s3", "ch2", 1)],
  },
];

function makeController(): PlanBoardController {
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

describe("Plan-board drag visuals (design drag polish)", () => {
  beforeEach(() => {
    draggingId = null;
    capturedOnDragStart = null;
    capturedOnDragEnd = null;
    capturedOnDragCancel = null;
  });

  it("idle board: no woa-dragging / woa-drag-active anywhere, columns carry data-col", () => {
    const { container } = render(
      <PlanGrid controller={makeController()} density="default" />,
    );
    expect(container.querySelector(".woa-dragging")).toBeNull();
    expect(container.querySelector(".woa-drag-active")).toBeNull();
    // The [data-col] hook the outline CSS targets — one per chapter column.
    expect(container.querySelectorAll("section[data-col]")).toHaveLength(2);
  });

  it("the dragged scene card carries woa-dragging with the tilt composed into the drag transform", () => {
    draggingId = "s1";
    const { container } = render(
      <PlanGrid controller={makeController()} density="default" />,
    );

    const dragging = container.querySelectorAll<HTMLElement>(".woa-dragging");
    expect(dragging).toHaveLength(1);
    expect(dragging[0].textContent).toContain("1. jelenet");

    // The pointer-following transform keeps working AND gains the design tilt
    // (composed inline, because inline style overrides the class transform).
    expect(dragging[0].style.transform).toBe(
      "translate3d(10px, 20px, 0) scaleX(1) scaleY(1) scale(0.97) rotate(-1.4deg)",
    );

    // No inline opacity: the class owns the fade (an inline 0.5 — the old
    // treatment — would override the class's 0.4).
    expect(dragging[0].style.opacity).toBe("");
  });

  it("non-dragged sibling cards are untouched", () => {
    draggingId = "s1";
    const { container } = render(
      <PlanGrid controller={makeController()} density="default" />,
    );
    const cards = Array.from(
      container.querySelectorAll<HTMLElement>(".woa-card-cv"),
    );
    expect(cards).toHaveLength(3);
    const siblings = cards.filter((c) => !c.querySelector(".woa-dragging"));
    expect(siblings).toHaveLength(2);
    for (const sibling of siblings) {
      const inner = sibling.querySelector<HTMLElement>("div.rounded-xl");
      expect(inner).not.toBeNull();
      expect(inner!.classList.contains("woa-dragging")).toBe(false);
      expect(inner!.style.transform).toBe("");
    }
  });

  it("a dragged CHAPTER column keeps its own look (woa-dragging is scene-only) but still has data-col", () => {
    draggingId = "ch1";
    const { container } = render(
      <PlanGrid controller={makeController()} density="default" />,
    );
    expect(container.querySelector(".woa-dragging")).toBeNull();
    const column = container.querySelectorAll<HTMLElement>(
      "section[data-col]",
    )[0];
    expect(column.style.opacity).toBe("0.5");
  });

  it("onDragStart toggles woa-drag-active on the columns wrapper; onDragEnd removes it", () => {
    const controller = makeController();
    const { container } = render(
      <PlanGrid controller={controller} density="default" />,
    );
    expect(capturedOnDragStart).not.toBeNull();
    expect(capturedOnDragEnd).not.toBeNull();

    act(() => {
      capturedOnDragStart!({ active: { id: "s1" } } as DragStartEvent);
    });
    const activeRoot = container.querySelector<HTMLElement>(".woa-drag-active");
    expect(activeRoot).not.toBeNull();
    // The outline affordance wiring: the drag-active root must CONTAIN the
    // [data-col] columns for `.woa-drag-active [data-col]` to match.
    expect(activeRoot!.querySelectorAll("section[data-col]")).toHaveLength(2);

    // Drop nowhere: the flag clears and no reorder fires.
    act(() => {
      capturedOnDragEnd!({
        active: { id: "s1" },
        over: null,
      } as unknown as DragEndEvent);
    });
    expect(container.querySelector(".woa-drag-active")).toBeNull();
    expect(controller.reorderScenes).not.toHaveBeenCalled();
    expect(controller.reorderChapters).not.toHaveBeenCalled();
    expect(controller.moveScene).not.toHaveBeenCalled();
  });

  it("a REAL drop still dispatches the reorder AND clears the drag-active flag", () => {
    const controller = makeController();
    const { container } = render(
      <PlanGrid controller={controller} density="default" />,
    );
    act(() => {
      capturedOnDragStart!({ active: { id: "s1" } } as DragStartEvent);
    });
    act(() => {
      capturedOnDragEnd!({
        active: { id: "s1" },
        over: { id: "s2" },
      } as unknown as DragEndEvent);
    });
    // Behaviour preserved: the same-chapter reorder fires exactly as before.
    expect(controller.reorderScenes).toHaveBeenCalledTimes(1);
    expect(controller.reorderScenes).toHaveBeenCalledWith("ch1", ["s2", "s1"]);
    expect(container.querySelector(".woa-drag-active")).toBeNull();
  });

  it("onDragCancel clears woa-drag-active (Esc mid-drag)", () => {
    const { container } = render(
      <PlanGrid controller={makeController()} density="default" />,
    );
    expect(capturedOnDragCancel).not.toBeNull();
    act(() => {
      capturedOnDragStart!({ active: { id: "ch1" } } as DragStartEvent);
    });
    expect(container.querySelector(".woa-drag-active")).not.toBeNull();
    act(() => {
      capturedOnDragCancel!();
    });
    expect(container.querySelector(".woa-drag-active")).toBeNull();
  });

  it("globals.css carries the drag-visuals contract (tripwire — jsdom applies no CSS)", () => {
    // jsdom cannot apply stylesheets, so the class assertions above prove the
    // WIRING; this pins the load-bearing CSS itself. Kept intentionally loose
    // (whitespace-tolerant) so formatting churn doesn't trip it.
    const css = readFileSync(
      resolve(__dirname, "../../../app/globals.css"),
      "utf8",
    );

    const dragging = css.match(/\.woa-dragging\s*\{[^}]*\}/)?.[0];
    expect(dragging).toBeTruthy();
    expect(dragging).toMatch(/opacity:\s*0?\.4/);
    expect(dragging).toMatch(/rotate\(-1\.4deg\)/);
    expect(dragging).toMatch(/box-shadow:[^;]*!important/);
    expect(dragging).toMatch(/cursor:\s*grabbing/);

    const outline = css.match(
      /\.woa-drag-active\s+\[data-col\]\s*\{[^}]*\}/,
    )?.[0];
    expect(outline).toBeTruthy();
    expect(outline).toMatch(/outline:[^;]*dashed[^;]*var\(--gold\)/);

    // While a drag is active the cards' content-visibility containment is
    // suspended — `contain: paint` (implied by content-visibility: auto)
    // clips the pointer-following card, its lifted shadow and the siblings'
    // shift previews to the wrapper's bounds (verified in real Chromium).
    const uncontain = css.match(
      /\.woa-drag-active\s+\.woa-card-cv\s*\{[^}]*\}/,
    )?.[0];
    expect(uncontain).toBeTruthy();
    expect(uncontain).toMatch(/content-visibility:\s*visible/);
  });
});
