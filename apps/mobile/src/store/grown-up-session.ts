import { endGrownUpTab } from '../platform/grown-up-tab';
import { pageLeaving } from '../platform/history-bridge';
import { useUiStore } from './ui-store';

/**
 * [OA] Why a session closed: `switch` a change of the active learner (the surface that made it may still be
 * navigating), `background` 5 minutes in the background, `exit` focus left the Grown-up area (or a gated action on a
 * learner screen was used up).
 */
export type SessionCloseReason = 'switch' | 'background' | 'exit';

/** [OA] What the listeners hear: why, and whether a grown-up session was open when it closed. */
export interface SessionClosed {
  reason: SessionCloseReason;
  /** The 15-minute gate or a fresh PIN was set just before the close; false when nothing was open. */
  wasOpen: boolean;
}

const closedListeners = new Set<(closed: SessionClosed) => void>();

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D5, OA-D5b, OA-D16 (section 6.3): the one way a grown-up session ends.
 * Clears the 15-minute gate session (`parentGateOpenedAt`), the fresh-PIN time (`lastPinVerifiedAt`) and a pending
 * PIN-screen return; on the web it also clears this tab's unlock, console session and All lessons pass
 * (`clearGrownUpTab`) and posts `{ v: 1, kind: 'lock' }` on `hr-grownup` so console tabs lock. Then it tells the
 * listeners (`onGrownUpSessionClosed`: the navigator leaves a Grown-up area page left open in front). Called from
 * `profile-store` on every change of the active learner, from the Grown-up area exit
 * (`navigation/grown-up-area-exit.ts`) and after 5 minutes in the background (`bindGrownUpBackgroundRule`). Always
 * on: no flag.
 */
export function closeGrownUpSession(reason: SessionCloseReason = 'exit'): void {
  const { parentGateOpenedAt, lastPinVerifiedAt } = useUiStore.getState();
  const closed: SessionClosed = { reason, wasOpen: parentGateOpenedAt !== null || lastPinVerifiedAt !== null };
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null, lastPinTypedAt: null, gateReturnPending: false });
  endGrownUpTab();
  for (const listener of [...closedListeners]) {
    try {
      listener(closed);
    } catch {
      // A listener that fails never keeps the session open: it is already closed above.
    }
  }
}

/**
 * [OA] CS-1 (OA-2 review round 2): the PIN screen's return keeps the session for the one action that waited on a
 * learner screen (a source link, Open-source notices). Once that action has run the session is used up, so a second
 * gated control on the same screen asks the PIN again. Ends nothing when no session is open (a device whose gate
 * needs no PIN), so it never locks a console tab for nothing.
 */
export function endGrownUpSessionAfterUse(): void {
  const { parentGateOpenedAt, lastPinVerifiedAt } = useUiStore.getState();
  if (parentGateOpenedAt === null && lastPinVerifiedAt === null) return;
  closeGrownUpSession('exit');
}

/** [OA] Calls `listener` after every `closeGrownUpSession`, with why and whether a session was open. Returns the unsubscribe. */
export function onGrownUpSessionClosed(listener: (closed: SessionClosed) => void): () => void {
  closedListeners.add(listener);
  return () => {
    closedListeners.delete(listener);
  };
}

/**
 * [OA] Section 6.3, OA-D5, CS-2 (row OA-4a): arriving at "Who is using this?" closes the grown-up session whatever
 * it was (`closeOnChooser` describes it): `closeGrownUpSession`, the one way a session ends, so the times, a pending
 * PIN-screen return, this tab's unlock and console session go, the `hr-grownup` lock is posted to the other tabs and
 * the listeners hear it. A grown-up row picked right after asks the PIN again. The one exception is a tab that is
 * leaving for another page (a PIN screen over the chooser handed off to the console or to All lessons and went back
 * as it left, `pageLeaving`): the unlock or pass it just wrote is what that page reads, so nothing is cleared.
 */
export function arriveAtChooser(leaving: () => boolean = pageLeaving): void {
  if (leaving()) return;
  closeGrownUpSession();
}
