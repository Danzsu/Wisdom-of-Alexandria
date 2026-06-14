/**
 * Serialise a dnd-kit `useSortable` transform into a CSS `transform` string.
 *
 * `@dnd-kit/sortable` returns a `{ x, y, scaleX, scaleY } | null` transform; the
 * canonical serialiser lives in `@dnd-kit/utilities` (`CSS.Transform.toString`),
 * which is a transitive-only dependency here. Rather than add a package, this
 * reproduces that exact output (`translate3d(x, y, 0) scaleX(..) scaleY(..)`) so
 * the cards animate identically. Returns `undefined` for a null transform so the
 * style is omitted entirely.
 */
export interface DndTransform {
  x: number;
  y: number;
  scaleX?: number;
  scaleY?: number;
}

export function dndTransformToCss(
  transform: DndTransform | null,
): string | undefined {
  if (!transform) return undefined;
  const { x, y, scaleX = 1, scaleY = 1 } = transform;
  return `translate3d(${x}px, ${y}px, 0) scaleX(${scaleX}) scaleY(${scaleY})`;
}
