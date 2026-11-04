import { createContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { tapNow } from './host';

/**
 * The app-level `board` lock (docs/specs/AMENDMENTS-TOUCH.md KT-D5, rule 10), mounted once in the app root above the
 * navigator. A `board` commit sets it to `now + TAP_LOCK_MS`; every board and every guarded press reads it, so the lock
 * survives a keyed per-round or per-item remount (Placement, Daily Review) and a screen change after Continue. One
 * clock (`tapNow`, the boards' clock). `locked` re-renders its readers when the lock ends.
 */
export interface TapLockClock {
  until(): number;
  extendTo(at: number): void;
  lock(ms: number): void;
  locked: boolean;
}

export const TapLockContext = createContext<TapLockClock | null>(null);

export function TapLockProvider({ children }: { children: ReactNode }): ReactElement {
  const until = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [locked, setLocked] = useState(false);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  const value = useMemo<TapLockClock>(() => {
    const extendTo = (at: number): void => {
      if (at <= until.current) return;
      until.current = at;
      setLocked(true);
      if (timer.current !== null) clearTimeout(timer.current);
      const settle = (): void => {
        const left = until.current - tapNow();
        if (left > 0) {
          timer.current = setTimeout(settle, left);
          return;
        }
        timer.current = null;
        setLocked(false);
      };
      timer.current = setTimeout(settle, Math.max(0, at - tapNow()));
    };
    return { until: () => until.current, extendTo, lock: (ms) => extendTo(tapNow() + ms), locked };
  }, [locked]);
  return <TapLockContext.Provider value={value}>{children}</TapLockContext.Provider>;
}
