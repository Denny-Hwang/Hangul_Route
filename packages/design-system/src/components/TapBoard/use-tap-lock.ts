import { useContext } from 'react';
import { TapBoardContext } from './context';
import type { TapLock } from './types';

const NO_BOARD: TapLock = { locked: false, lock: () => undefined };

/**
 * The nearest board's lock (docs/specs/AMENDMENTS-TOUCH.md section 4.1): a control outside the board's targets reads
 * `locked` (Sentence Builder's Skip waits while the tray is locked), and a game extends it with `lock(ms)` (a slide-back
 * or a reset animation). Outside any board: never locked, and `lock` does nothing.
 */
export function useTapLock(): TapLock {
  const board = useContext(TapBoardContext);
  return board === null ? NO_BOARD : { locked: board.locked, lock: board.lock };
}
