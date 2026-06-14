import { describe, expect, it } from "vitest";
import { computeReorder } from "../reorder-logic";
import type { PlanChapter, PlanScene } from "../types";

/** Minimal PlanScene factory for the logic tests. */
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
      created_at: "2026-06-14T14:32:00Z",
      updated_at: "2026-06-14T14:32:00Z",
    },
  };
}

/** Two-chapter board: ch1 [s1, s2, s3], ch2 [s4, s5]. */
function board(): PlanChapter[] {
  return [
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
}

describe("computeReorder", () => {
  it("returns null when there is no drop target", () => {
    expect(computeReorder(board(), { active: { id: "s1" }, over: null })).toBeNull();
  });

  it("returns null when dropped on itself", () => {
    expect(
      computeReorder(board(), { active: { id: "s1" }, over: { id: "s1" } }),
    ).toBeNull();
  });

  it("reorders a scene within its chapter (moving s1 onto s3)", () => {
    const result = computeReorder(board(), {
      active: { id: "s1" },
      over: { id: "s3" },
    });
    expect(result).toEqual({
      kind: "scene",
      chapterId: "ch1",
      order: ["s2", "s3", "s1"],
    });
  });

  it("reorders a scene upward within its chapter (moving s3 onto s1)", () => {
    const result = computeReorder(board(), {
      active: { id: "s3" },
      over: { id: "s1" },
    });
    expect(result).toEqual({
      kind: "scene",
      chapterId: "ch1",
      order: ["s3", "s1", "s2"],
    });
  });

  it("does NOT produce a cross-chapter scene move (returns null)", () => {
    // s1 (ch1) dropped onto s4 (ch2) — the backend has no cross-chapter move,
    // so this must be a no-op rather than a bad persist.
    expect(
      computeReorder(board(), { active: { id: "s1" }, over: { id: "s4" } }),
    ).toBeNull();
  });

  it("reorders chapters (moving ch1 onto ch2)", () => {
    const result = computeReorder(board(), {
      active: { id: "ch1" },
      over: { id: "ch2" },
    });
    expect(result).toEqual({ kind: "chapter", order: ["ch2", "ch1"] });
  });

  it("returns null for an unresolved active id", () => {
    expect(
      computeReorder(board(), { active: { id: "ghost" }, over: { id: "s1" } }),
    ).toBeNull();
  });
});
