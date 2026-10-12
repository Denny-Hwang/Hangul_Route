import { gateOpensDirectly } from '../logic/profiles/gate-route';
import { isParentSessionValid } from '../logic/profiles/session';
import { useAccountStore } from './account-store';
import { useProfileStore } from './profile-store';
import { useUiStore } from './ui-store';

/**
 * Whether a grown-up action skips the PIN screen right now (F-LEARN-001 L7), read fresh from the
 * stores rather than from a render: the PIN screen opens the session just before it returns to the
 * screen that asked, so a focus effect must see the new session. One copy for every screen that
 * hands off to the browser through the gate (Sources' Open link, the Plan screen's Open billing).
 */
export function gateOpensDirectlyNow(now: number = Date.now()): boolean {
  const openedAt = useUiStore.getState().parentGateOpenedAt;
  return gateOpensDirectly({
    profiles: useProfileStore.getState().profiles,
    parentPinHash: useAccountStore.getState().parentPinHash,
    sessionOpen: isParentSessionValid(openedAt === null ? null : { openedAt, profileId: 'family' }, now),
  });
}
