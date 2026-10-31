import { useCallback, useRef } from 'react';
import { pressGuardAllows } from '../../tap-model';
import type { PressGuard } from './types';

/**
 * The Button guard (docs/specs/AMENDMENTS-TOUCH.md section 4.4, R8) as a hook: every function it wraps shares one
 * clock, so a bounce on any of them within `TAP_LOCK_MS` of the last press is dropped. For a press outside a board
 * (Continue, Next, a speaker) and for a `TapTarget` with no board around it.
 */
export function usePressGuard(): PressGuard {
  const last = useRef<number | null>(null);
  return useCallback<PressGuard>(
    (fn) =>
      (...args) => {
        const now = Date.now();
        if (!pressGuardAllows(last.current, now)) return;
        last.current = now;
        fn?.(...args);
      },
    [],
  );
}
