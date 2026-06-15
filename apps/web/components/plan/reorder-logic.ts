/**
 * Pure reorder logic for the Plan Board's dnd-kit `onDragEnd`. Kept separate
 * from the React component so it can be unit-tested directly (pointer drags are
 * flaky in jsdom — we assert the computed order payloads instead).
 *
 * Three drag kinds are supported:
 * - CHAPTER reorder: a column dragged over another column → new chapter id order.
 * - SCENE reorder WITHIN its chapter: a card dragged over another card in the
 *   same chapter → new scene id order for that chapter.
 * - SCENE move ACROSS chapters: a card dropped onto another chapter's card (or
 *   onto an empty chapter column) → a move descriptor naming the source/target
 *   chapters and the target insertion index. (P1.5 — the backend now has a
 *   `POST /scenes/{id}/move` endpoint, so this is a real persist, not a no-op.)
 */
import type { PlanChapter } from "./types";

/** A computed reorder result the controller turns into a mutation call. */
export type ReorderResult =
  | { kind: "chapter"; order: string[] }
  | { kind: "scene"; chapterId: string; order: string[] }
  | {
      kind: "move";
      sceneId: string;
      fromChapterId: string;
      toChapterId: string;
      /** 0-based slot to insert the scene at within the target chapter. */
      targetIndex: number;
    }
  | null;

/** The minimal drag event shape we consume (mirrors dnd-kit's DragEndEvent). */
export interface DragEndLike {
  active: { id: string | number };
  over: { id: string | number } | null;
}

/** Move the item at `from` to `to` in a fresh array (pure). */
function arrayMove<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Compute the reorder payload for a drag-end against the current board model.
 * Returns null when there is nothing to persist (no drop target, dropped on
 * itself, or an unresolved id). A scene dropped onto another chapter yields a
 * cross-chapter `move` descriptor (P1.5).
 */
export function computeReorder(
  chapters: PlanChapter[],
  event: DragEndLike,
): ReorderResult {
  const { active, over } = event;
  if (!over) return null;
  const activeId = String(active.id);
  const overId = String(over.id);
  if (activeId === overId) return null;

  // CHAPTER drag: both ids are chapter ids.
  const activeChapterIdx = chapters.findIndex((c) => c.id === activeId);
  if (activeChapterIdx !== -1) {
    const overChapterIdx = chapters.findIndex((c) => c.id === overId);
    if (overChapterIdx === -1) return null; // dropped on a non-chapter target
    const order = arrayMove(
      chapters.map((c) => c.id),
      activeChapterIdx,
      overChapterIdx,
    );
    return { kind: "chapter", order };
  }

  // SCENE drag: find which chapter owns the active scene.
  const sourceChapter = chapters.find((c) =>
    c.scenes.some((s) => s.id === activeId),
  );
  if (!sourceChapter) return null;

  const fromIdx = sourceChapter.scenes.findIndex((s) => s.id === activeId);

  // SAME-chapter reorder: dropped onto another card in the source chapter.
  const overSceneIdx = sourceChapter.scenes.findIndex((s) => s.id === overId);
  if (overSceneIdx !== -1) {
    if (fromIdx === overSceneIdx) return null;
    const order = arrayMove(
      sourceChapter.scenes.map((s) => s.id),
      fromIdx,
      overSceneIdx,
    );
    return { kind: "scene", chapterId: sourceChapter.id, order };
  }

  // CROSS-chapter move (P1.5). The drop target is either:
  //  - another chapter's CARD → insert at that card's index in its chapter, or
  //  - a chapter COLUMN (its droppable id is the chapter id; the case when a
  //    scene is dropped onto an empty column / its header) → append at the end.
  const targetChapterByScene = chapters.find((c) =>
    c.scenes.some((s) => s.id === overId),
  );
  if (targetChapterByScene) {
    const targetIndex = targetChapterByScene.scenes.findIndex(
      (s) => s.id === overId,
    );
    return {
      kind: "move",
      sceneId: activeId,
      fromChapterId: sourceChapter.id,
      toChapterId: targetChapterByScene.id,
      targetIndex,
    };
  }

  const targetColumn = chapters.find((c) => c.id === overId);
  if (targetColumn) {
    return {
      kind: "move",
      sceneId: activeId,
      fromChapterId: sourceChapter.id,
      toChapterId: targetColumn.id,
      targetIndex: targetColumn.scenes.length, // append
    };
  }

  // Unresolved drop target — no-op rather than a bad persist.
  return null;
}
