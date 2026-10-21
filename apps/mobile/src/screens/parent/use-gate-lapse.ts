import { useCallback, useEffect, useState } from 'react';
import { backgroundLapsed, isParentSessionValid, parentSessionRemainingMs } from '../../logic/profiles/session';
import { subscribeAppVisibility, subscribePageRestore } from '../../platform/app-visibility';
import { closeGrownUpSession } from '../../store/grown-up-session';
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

export interface BackgroundRuleDeps {
  /** App in front or not: native `AppState`, the web `visibilitychange`, `pagehide` and `pageshow`. */
  subscribe: (listener: (visible: boolean) => void) => () => void;
  now: () => number;
  close: () => void;
  /** Whether a grown-up session (the gate or a fresh PIN) is open now. */
  sessionOpen: () => boolean;
}

const browserDeps = (): BackgroundRuleDeps => ({
  subscribe: subscribeAppVisibility,
  now: () => Date.now(),
  close: () => closeGrownUpSession('background'),
  sessionOpen: () => {
    const { parentGateOpenedAt, lastPinVerifiedAt } = useUiStore.getState();
    return parentGateOpenedAt !== null || lastPinVerifiedAt !== null;
  },
});

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D16 (section 8.4, CS-14): a grown-up session ends after
 * `GROWN_UP_BACKGROUND_MS` (5 minutes) in the background, on native and on the web. Wall-clock times (when the
 * app was hidden, when it came back), not a timer, so a suspended page still counts. Bound once for the learner
 * app (App.tsx); every screen that reads the session (`useGateLapse`) re-renders when it closes. Always on.
 * Returns the unsubscribe.
 */
export function bindGrownUpBackgroundRule(deps: BackgroundRuleDeps = browserDeps()): () => void {
  let hiddenAt: number | null = null;
  return deps.subscribe((visible) => {
    if (!visible) {
      hiddenAt ??= deps.now();
      return;
    }
    if (backgroundLapsed(hiddenAt, deps.now()) && deps.sessionOpen()) deps.close();
    hiddenAt = null;
  });
}

export interface ResetSetupLapseDeps {
  /** App in front or not (`subscribeAppVisibility`). */
  subscribe: (listener: (visible: boolean) => void) => () => void;
  /** A page restored from the back/forward cache (`subscribePageRestore`; never on native). */
  onRestore: (listener: () => void) => () => void;
  now: () => number;
  /** Leaves the new-PIN screen for the screen under it. */
  close: () => void;
}

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.5 and OA-D16 (row OA-6 review): a new-PIN screen a reset opened (the
 * sign-in ticket, the Rescue Code, the wait) is the proof's own moment, not an open door. It closes when the page comes
 * back from the back/forward cache, and after `GROWN_UP_BACKGROUND_MS` (5 minutes) in the background, measured by wall
 * clock as the grown-up session is, so a tab left on Choose a new grown-up PIN never lets someone else set the PIN
 * later. Closing writes nothing; Forgot PIN? starts again. Returns the unsubscribe.
 */
export function bindResetSetupLapse(deps: ResetSetupLapseDeps): () => void {
  let hiddenAt: number | null = null;
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    deps.close();
  };
  const offVisibility = deps.subscribe((visible) => {
    if (!visible) {
      hiddenAt ??= deps.now();
      return;
    }
    if (backgroundLapsed(hiddenAt, deps.now())) close();
    hiddenAt = null;
  });
  const offRestore = deps.onRestore(close);
  return () => {
    offVisibility();
    offRestore();
  };
}

/** [OA] The browser's (or the app's) side of `bindResetSetupLapse`, closing with `close`. */
export function resetSetupLapseDeps(close: () => void): ResetSetupLapseDeps {
  return { subscribe: subscribeAppVisibility, onRestore: subscribePageRestore, now: () => Date.now(), close };
}
