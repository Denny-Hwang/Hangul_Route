import { useCallback, useEffect, useState } from 'react';
import { isParentSessionValid, parentSessionRemainingMs } from '../../logic/profiles/session';
import { useUiStore } from '../../store/ui-store';

interface FocusSource {
  addListener: (type: 'focus', callback: () => void) => () => void;
}

const sessionOf = (openedAt: number | null): { openedAt: number; profileId: string } | null => (openedAt === null ? null : { openedAt, profileId: 'family' });

/**
 * The grown-up session on a screen left open (F-FEEDBACK-001 FB-9; the LearnerReportScreen pattern):
 * a render when the 15-minute session lapses and whenever the screen comes back into focus, so a
 * screen that checks the gate on render hands over to the PIN screen instead of staying usable.
 * `stillOpen` re-reads the clock for an action about to call the Worker with a grown-up attestation.
 */
export function useGateLapse(navigation: FocusSource): { sessionOpen: boolean; stillOpen: () => boolean } {
  const parentGateOpenedAt = useUiStore((s) => s.parentGateOpenedAt);
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    const left = parentSessionRemainingMs(sessionOf(parentGateOpenedAt), Date.now());
    if (left <= 0) return undefined;
    const timer = setTimeout(rerender, left);
    return () => clearTimeout(timer);
  }, [parentGateOpenedAt, rerender]);

  useEffect(() => navigation.addListener('focus', rerender), [navigation, rerender]);

  const stillOpen = useCallback((): boolean => {
    const open = isParentSessionValid(sessionOf(useUiStore.getState().parentGateOpenedAt), Date.now());
    if (!open) rerender();
    return open;
  }, [rerender]);

  return { sessionOpen: isParentSessionValid(sessionOf(parentGateOpenedAt), Date.now()), stillOpen };
}
