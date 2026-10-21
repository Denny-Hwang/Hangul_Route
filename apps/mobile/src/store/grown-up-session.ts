import { endGrownUpTab } from '../platform/grown-up-tab';
import { useUiStore } from './ui-store';

const closedListeners = new Set<() => void>();

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
export function closeGrownUpSession(): void {
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null, gateReturnPending: false });
  endGrownUpTab();
  for (const listener of [...closedListeners]) {
    try {
      listener();
    } catch {
      // A listener that fails never keeps the session open: it is already closed above.
    }
  }
}

/** [OA] Calls `listener` after every `closeGrownUpSession`. Returns the unsubscribe. */
export function onGrownUpSessionClosed(listener: () => void): () => void {
  closedListeners.add(listener);
  return () => {
    closedListeners.delete(listener);
  };
}
