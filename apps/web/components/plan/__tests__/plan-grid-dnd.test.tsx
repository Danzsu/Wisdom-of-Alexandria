/**
 * Unit test for PlanGrid's `onDragEnd` wiring (P1.5). Real pointer drags are
 * flaky in jsdom (see reorder-logic.ts), so we mock `@dnd-kit/core` to CAPTURE
 * the `onDragEnd` handler PlanGrid passes to `DndContext`, then invoke it with
 * synthetic drag-end events and assert the controller fires the RIGHT action:
 *  - a cross-chapter scene drop → `moveScene`,
 *  - a same-chapter scene drop  → `reorderScenes`,
 *  - a chapter-over-chapter drop → `reorderChapters`.
 * This complements the pure `computeReorder` tests (which cover the descriptors)
 * by proving the dispatch in `handleDragEnd` routes each kind correctly.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import type { DragEndEvent } from "@dnd-kit/core";
import type { PlanChapter, PlanScene } from "../types";
import type { PlanBoardController } from "../use-plan-board";

// Capture the onDragEnd handler PlanGrid wires into DndContext, and stub the
// sortable/context primitives so the component renders without a real dnd runtime.
let capturedOnDragEnd: ((event: DragEndEvent) => void) | null = null;

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragEnd,
  }: {
    children: React.ReactNode;
    onDragEnd: (event: DragEndEvent) => void;
  }) => {
    capturedOnDragEnd = onDragEnd;
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
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    setActivatorNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
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
      created_at: "2026-06-15T10:00:00Z",
      updated_at: "2026-06-15T10:00:00Z",
    },
  };
}

/** ch1 [s1, s2, s3], ch2 [s4, s5]. */
const chapters: PlanChapter[] = [
  {
    id: "ch1",
    bookId: "book",
    index: 1,
    title: "I. fejezet",
    raw: {} as PlanChapter["raw"],
    scenes: [scene("s1", "ch1", 1), scene("s2", "ch1", 2), scene("s3", "ch1", 3)],
  },
  {
    id: "ch2",
    bookId: "book",
    index: 2,
    title: "II. fejezet",
    raw: {} as PlanChapter["raw"],
    scenes: [scene("s4", "ch2", 1), scene("s5", "ch2", 2)],
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

function dragEnd(activeId: string, overId: string | null): DragEndEvent {
  return {
    active: { id: activeId },
    over: overId ? { id: overId } : null,
  } as unknown as DragEndEvent;
}

describe("PlanGrid onDragEnd dispatch (P1.5)", () => {
  beforeEach(() => {
    capturedOnDragEnd = null;
  });

  it("fires moveScene for a CROSS-chapter scene drop", () => {
    const controller = makeController();
    render(<PlanGrid controller={controller} density="default" />);
    expect(capturedOnDragEnd).not.toBeNull();

    // s1 (ch1) dropped onto s5 (ch2, index 1) → move into ch2 at index 1.
    capturedOnDragEnd!(dragEnd("s1", "s5"));

    expect(controller.moveScene).toHaveBeenCalledTimes(1);
    expect(controller.moveScene).toHaveBeenCalledWith("s1", "ch1", "ch2", 1);
    expect(controller.reorderScenes).not.toHaveBeenCalled();
    expect(controller.reorderChapters).not.toHaveBeenCalled();
  });

  it("fires reorderScenes for a SAME-chapter scene drop", () => {
    const controller = makeController();
    render(<PlanGrid controller={controller} density="default" />);

    // s1 dropped onto s3 within ch1 → reorder ch1.
    capturedOnDragEnd!(dragEnd("s1", "s3"));

    expect(controller.reorderScenes).toHaveBeenCalledTimes(1);
    expect(controller.reorderScenes).toHaveBeenCalledWith("ch1", [
      "s2",
      "s3",
      "s1",
    ]);
    expect(controller.moveScene).not.toHaveBeenCalled();
  });

  it("fires reorderChapters for a chapter-over-chapter drop", () => {
    const controller = makeController();
    render(<PlanGrid controller={controller} density="default" />);

    capturedOnDragEnd!(dragEnd("ch1", "ch2"));

    expect(controller.reorderChapters).toHaveBeenCalledWith(["ch2", "ch1"]);
    expect(controller.moveScene).not.toHaveBeenCalled();
    expect(controller.reorderScenes).not.toHaveBeenCalled();
  });

  it("does nothing when there is no drop target", () => {
    const controller = makeController();
    render(<PlanGrid controller={controller} density="default" />);

    capturedOnDragEnd!(dragEnd("s1", null));

    expect(controller.moveScene).not.toHaveBeenCalled();
    expect(controller.reorderScenes).not.toHaveBeenCalled();
    expect(controller.reorderChapters).not.toHaveBeenCalled();
  });
});
