import { endGrownUpTab } from '../platform/grown-up-tab';
import { useUiStore } from './ui-store';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D5, OA-D5b, OA-D16 (section 6.3): the one way a grown-up session ends.
 * Clears the 15-minute gate session (`parentGateOpenedAt`) and the fresh-PIN time (`lastPinVerifiedAt`); on the web
 * it also clears this tab's unlock, console session and All lessons pass (`clearGrownUpTab`) and posts
 * `{ v: 1, kind: 'lock' }` on `hr-grownup` so console tabs lock. Called from `profile-store.setActive` on every
 * change of learner, from the Grown-up area exit (`navigation/grown-up-area-exit.ts`) and after 5 minutes in the
 * background (`bindGrownUpBackgroundRule`). Always on: no flag.
 */
export function closeGrownUpSession(): void {
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
  endGrownUpTab();
}
