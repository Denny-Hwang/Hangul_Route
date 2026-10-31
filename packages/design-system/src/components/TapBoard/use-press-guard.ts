import { useCallback, useContext, useRef } from 'react';
import { TAP_LOCK_MS, pressGuardAllows } from '../../tap-model';
import { pressIsTouch, tapNow } from './host';
import { TapLockContext } from './TapLockProvider';
import type { PressGuard, PressGuardOptions } from './types';

/**
 * The Button guard (docs/specs/AMENDMENTS-TOUCH.md section 4.4, R8) as a hook: a second press of the same control within
 * `TAP_LOCK_MS` is dropped, and so is any press while the app-level lock is on. By default a press that runs also sets
 * that lock, so a bounce on Continue cannot answer on the next screen and a bounce on an answer cannot press a Continue
 * that appears under the finger; a control that moves nothing (a speaker) passes `setsLock: false`. A bounce is a
 * finger's, so only a finger's (or a pen's) press is guarded: a mouse click, keyboard Enter or Space and a screen
 * reader's activate are deliberate, run at once, and set no lock (`pressIsTouch`; on native every press is a finger).
 */
export function usePressGuard(options: PressGuardOptions = {}): PressGuard {
  const last = useRef<number | null>(null);
  const app = useContext(TapLockContext);
  const appNow = useRef(app);
  appNow.current = app;
  const setsLock = options.setsLock !== false;
  return useCallback<PressGuard>(
    (fn) =>
      (...args) => {
        if (!pressIsTouch(args[0])) {
          fn?.(...args);
          return;
        }
        const now = tapNow();
        const clock = appNow.current;
        if (!pressGuardAllows(last.current, now)) return;
        if (clock !== null && now < clock.until()) return;
        last.current = now;
        if (setsLock) clock?.lock(TAP_LOCK_MS);
        fn?.(...args);
      },
    [setsLock],
  );
}
