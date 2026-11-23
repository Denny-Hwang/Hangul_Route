import { reviewedStrokeIds } from '../content/jamo-strokes';

/**
 * [SO] AMENDMENTS-STROKE-ORDER-STANDARD §3.1: the one gate for teaching a stroke order. A letter's order (and its
 * open-stroke directions) is taught only once a person has checked it and added its id to `reviewedStrokeIds` (row
 * SO-3; the list is empty until then). Every surface asks this: Trace Stroke's coaching and Show me, Trace a Word's,
 * and the presenter's stroke panel. Until then they show the letter's shape, never an order.
 */
export function strokeOrderTaught(jamoId: string, reviewed: readonly string[] = reviewedStrokeIds): boolean {
  return reviewed.includes(jamoId);
}

/**
 * A Trace a Word unit (a block, or one letter in letter mode) or a composite letter (ㅘ = ㅗ + ㅏ, ㄲ, ㄺ): its order is
 * taught only when every jamo id of every letter is. An empty unit, or a letter with no ids, is not taught.
 */
export function unitOrderTaught(
  letters: readonly { jamoIds?: readonly string[] }[],
  reviewed: readonly string[] = reviewedStrokeIds,
): boolean {
  return (
    letters.length > 0 &&
    letters.every((l) => l.jamoIds !== undefined && l.jamoIds.length > 0 && l.jamoIds.every((id) => strokeOrderTaught(id, reviewed)))
  );
}
