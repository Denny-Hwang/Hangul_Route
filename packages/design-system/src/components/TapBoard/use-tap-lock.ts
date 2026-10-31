import { useContext } from 'react';
import { TapBoardContext } from './context';
import { TapLockContext } from './TapLockProvider';
import type { TapLock } from './types';

const NO_LOCK: TapLock = { locked: false, lock: () => undefined };

/**
 * The `board` lock (docs/specs/AMENDMENTS-TOUCH.md rule 10) from any component: the app-level `TapLockProvider` clock,
 * inside a board or not (Sentence Builder's Skip waits while it runs; a slide-back extends it with `lock(ms)`). With no
 * provider (an isolated test or story), the nearest board's own clock; with neither, never locked.
 */
export function useTapLock(): TapLock {
  const app = useContext(TapLockContext);
  const board = useContext(TapBoardContext);
  if (app !== null) return { locked: app.locked, lock: app.lock };
  return board === null ? NO_LOCK : { locked: board.locked, lock: board.lock };
}
