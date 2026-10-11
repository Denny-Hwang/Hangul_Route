/**
 * The pure part of the card flip (F-VOC-003 section 3.5, F-MOTION-002): which
 * face comes next, what a press does and when the midpoint may swap. The
 * animation itself is components/FlipCard.tsx.
 */
export type FlipFace = 'front' | 'back';

export function nextFace(face: FlipFace): FlipFace {
  return face === 'front' ? 'back' : 'front';
}

/** A tap starts a flip only when the card is enabled and not already turning (F-MOTION-002 section 3.3). */
export function mayFlip(state: { disabled?: boolean; flipping: boolean }): boolean {
  return !state.disabled && !state.flipping;
}

/** What a press does: nothing, an instant swap (reduced motion), or the two-leg turn. */
export type FlipAction = 'ignore' | 'instant' | 'animate';

export function flipAction(state: { disabled?: boolean; flipping: boolean; reducedMotion: boolean }): FlipAction {
  if (!mayFlip(state)) return 'ignore';
  return state.reducedMotion ? 'instant' : 'animate';
}

/**
 * Whether the edge-on midpoint may call `onFlip`. Only when the first leg ran
 * to the end and the caller still shows the face the tap started on: a caller
 * that moved on mid-turn (flashcards: "Got it" to the next word) must not have
 * the next card flipped to its answer.
 */
export function swapAtEdge(state: { finished: boolean; startFace: FlipFace; currentFace: FlipFace }): boolean {
  return state.finished && state.startFace === state.currentFace;
}

const NUM = String.raw`\s*(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*`;
const CUBIC_BEZIER = new RegExp(`^cubic-bezier\\(${NUM},${NUM},${NUM},${NUM}\\)$`, 'i');

/** The four control points of a CSS `cubic-bezier(...)` token, or null when it is not one. */
export function cubicBezierPoints(value: string): [number, number, number, number] | null {
  const m = CUBIC_BEZIER.exec(value.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
}
