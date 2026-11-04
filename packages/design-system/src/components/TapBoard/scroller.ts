import { createContext, useContext } from 'react';
import type { TapScrollerLike } from './controller';

/**
 * The scroll container a board may drive (docs/specs/AMENDMENTS-TOUCH.md section 4.1, rule 5): `{ axis, canScroll,
 * scrollBy(delta), onScroll(listener) }`. `Screen` provides one for its ScrollView (axis `y`); a game whose board sits in
 * its own horizontal ScrollView wraps that one in `TapScroller` (axis `x`). `scrollBy` moves the offset by `delta`
 * (clamped to the content) and returns the offset it moved to; `onScroll` hears every offset change, the board's own
 * included.
 */
export const TapScrollerContext = createContext<TapScrollerLike | null>(null);

export function useTapScroller(): TapScrollerLike | null {
  return useContext(TapScrollerContext);
}
