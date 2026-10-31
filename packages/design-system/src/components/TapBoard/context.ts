import { createContext } from 'react';
import type { TapControlEntry, TapTargetEntry } from './controller';

/** What a `TapBoard` hands its targets, controls and `useTapLock` (AMENDMENTS-TOUCH section 4). */
export interface TapBoardContextValue {
  register(id: string, entry: TapTargetEntry): () => void;
  registerControl(id: string, entry: TapControlEntry): () => void;
  click(id: string, stamp?: unknown): void;
  lock(ms: number): void;
  /** Native: measure the rectangles again (a target or control laid out). */
  remeasure(): void;
  locked: boolean;
  pressed: ReadonlySet<string>;
}

export const TapBoardContext = createContext<TapBoardContextValue | null>(null);
