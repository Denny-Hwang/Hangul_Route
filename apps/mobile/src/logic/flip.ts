/**
 * The pure part of the card flip (F-VOC-003 section 3.5, F-MOTION-002): which
 * face comes next and whether a tap may start a flip. The animation itself is
 * components/FlipCard.tsx.
 */
export type FlipFace = 'front' | 'back';

export function nextFace(face: FlipFace): FlipFace {
  return face === 'front' ? 'back' : 'front';
}

/** A tap starts a flip only when the card is enabled and not already turning (F-MOTION-002 section 3.3). */
export function mayFlip(state: { disabled?: boolean; flipping: boolean }): boolean {
  return !state.disabled && !state.flipping;
}
