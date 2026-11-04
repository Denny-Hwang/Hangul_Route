import type { ReactElement } from 'react';
import { TapScrollerContext } from './scroller';
import type { TapScrollerProps } from './types';

/**
 * Hands the boards inside it a scroller to drive (section 4.1): a game's own ScrollView (Hidden Heritage's horizontal
 * scene in its narrow latch) wraps its content in one. `Screen` provides its own for its vertical ScrollView.
 */
export function TapScroller({ scroller, children }: TapScrollerProps): ReactElement {
  return <TapScrollerContext.Provider value={scroller}>{children}</TapScrollerContext.Provider>;
}
