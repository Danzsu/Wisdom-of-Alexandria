/**
 * Pure reorder logic for the Plan Board's dnd-kit `onDragEnd`. Kept separate
 * from the React component so it can be unit-tested directly (pointer drags are
 * flaky in jsdom — we assert the computed order payloads instead).
 *
 * Two drag kinds are supported:
 * - CHAPTER reorder: a column dragged over another column → new chapter id order.
 * - SCENE reorder WITHIN its chapter: a card dragged over another card in the
 *   same chapter → new scene id order for that chapter.
 *
 * Cross-chapter scene moves are intentionally NOT produced: the backend has no
 * cross-chapter move (SceneUpdate carries no chapter_id), so a scene dropped onto
 * a different chapter's card resolves to "no change" (returns null) rather than
 * persisting a move the API cannot honour.
 */
import type { PlanChapter } from "./types";

/** A computed reorder result the controller turns into a mutation call. */
export type ReorderResult =
  | { kind: "chapter"; order: string[] }
  | { kind: "scene"; chapterId: string; order: string[] }
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
 * itself, a cross-chapter scene drop, or an unresolved id).
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

  // Resolve the drop target: either another scene, or a chapter column (when
  // dropped on the column's droppable rather than a card).
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

  // Dropped onto something not in this chapter (another chapter / its scene):
  // unsupported cross-chapter move — no-op rather than a bad persist.
  return null;
}
