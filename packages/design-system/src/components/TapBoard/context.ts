import { createContext } from 'react';
import type { TapTargetEntry } from './controller';

/** What a `TapBoard` hands its targets and `useTapLock` (AMENDMENTS-TOUCH section 4). */
export interface TapBoardContextValue {
  register(id: string, entry: TapTargetEntry): () => void;
  click(id: string): void;
  lock(ms: number): void;
  locked: boolean;
  pressed: ReadonlySet<string>;
}

export const TapBoardContext = createContext<TapBoardContextValue | null>(null);
