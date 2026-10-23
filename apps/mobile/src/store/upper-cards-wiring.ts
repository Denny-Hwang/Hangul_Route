import { useProgressStore } from './progress-store';
import { currFlagOn, useRemoteConfigStore } from './remote-config-store';
import { setUpperCardsSwitch } from './upper-cards-switch';

/**
 * Wires `upperCards` into the award reconcile (F-CURR-002 §4.8 step 7, row CM-23). Called once from `App.tsx`:
 *
 * - every reconcile (launch, sync, restore, a new profile) reads the switch for that learner;
 * - when the remote copy arrives or changes after launch and turns the switch on for a hydrated learner, the reconcile
 *   runs then, so the upper-cell cards of cells finished before the row shipped arrive once (awards only add).
 *
 * Returns the unsubscribe.
 */
export function wireUpperCards(): () => void {
  setUpperCardsSwitch((profileId) => currFlagOn('upperCards', profileId));
  return useRemoteConfigStore.subscribe((s, prev) => {
    if (s.cache === prev.cache && s.hydrated === prev.hydrated) return;
    const progress = useProgressStore.getState();
    for (const id of progress.hydratedFor) if (currFlagOn('upperCards', id)) progress.reconcileAwards(id);
  });
}
